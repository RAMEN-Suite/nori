import { GAttribute, GConstraint, GDataType, GModel, GNode, GRelation, Id } from '../models/GModel';
import { GModelIndex } from '../validation/container/GModelIndex';
import { Refs } from '../validation/container/References';
import { BaseNode, SemanticHelper } from './SemanticHelper';
import ShortUniqueId from 'short-unique-id';

export interface CreateNodeInput {
  readonly name: string;
  readonly baseNodeId: Id;
}

export interface CreateRelationInput {
  readonly baseRelationId: Id;
  readonly fromNodeId: Id;
  readonly toNodeId: Id;
}

export interface CreateDataTypeInput {
  readonly name: string;
}

export type ConnectedNode = {
  readonly node: GNode;
  readonly relations: ReadonlyArray<GRelation>;
};

export class SuggestionHelper {
  public listNodes(model: GModel): ReadonlyArray<GNode> {
    const modelIndex: GModelIndex = new GModelIndex(model);
    const nodes: GNode[] = Array.from(modelIndex.nodesById.values());
    return nodes.sort((a: GNode, b: GNode): number => a.name.localeCompare(b.name));
  }

  public listRelations(model: GModel): ReadonlyArray<GRelation> {
    const modelIndex: GModelIndex = new GModelIndex(model);
    const relations: GRelation[] = Array.from(modelIndex.relationsById.values());
    return relations.sort((a: GRelation, b: GRelation): number => a.name.localeCompare(b.name));
  }

  public listDataTypes(model: GModel): ReadonlyArray<GDataType> {
    const modelIndex: GModelIndex = new GModelIndex(model);
    const types: GDataType[] = Array.from(modelIndex.dataTypesById.values());
    return types.sort((a: GDataType, b: GDataType): number => a.name.localeCompare(b.name));
  }

  public listAllDataTypes(base: GModel, derived: GModel): ReadonlyArray<GDataType> {
    const baseIndex = new GModelIndex(base);
    const derivedIndex = new GModelIndex(derived);
    const types: GDataType[] = [...derivedIndex.dataTypesById.values()];

    for (const dataType of baseIndex.dataTypesById.values()) {
      types.push({ ...dataType, id: Refs.qualify(base.id, dataType.id) });
    }

    return types.sort((a: GDataType, b: GDataType): number => a.name.localeCompare(b.name));
  }

  public listForbiddenAttributes(base: GModel, derived: GModel, nodeId: Id): ReadonlySet<string> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const derivedIndex: GModelIndex = new GModelIndex(derived);

    const node: GNode | undefined = derivedIndex.nodesById.get(nodeId);
    if (!node) return new Set<string>();

    const forbidden: Set<string> = new Set<string>();
    const superType: BaseNode | null = SemanticHelper.getBaseSuperType(node, base.id);

    if (superType) {
      const baseNode: GNode | undefined = baseIndex.nodesById.get(superType.baseNodeId);
      const baseAttributes: GAttribute[] = baseNode?.attributes ?? [];
      for (const attribute of baseAttributes) forbidden.add(attribute.name);
    }

    const ownAttributes: GAttribute[] = node.attributes ?? [];
    for (const attribute of ownAttributes) forbidden.add(attribute.name);

    return forbidden;
  }

  public listFromRelations(base: GModel, derived: GModel, fromNodeId: Id): ReadonlyArray<GRelation> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const derivedIndex: GModelIndex = new GModelIndex(derived);

    const fromNode: GNode | undefined = derivedIndex.nodesById.get(fromNodeId);
    if (!fromNode) return [];

    const superType: BaseNode | null = SemanticHelper.getBaseSuperType(fromNode, base.id);
    if (!superType) return [];

    const allowed: GRelation[] = [];
    for (const relation of baseIndex.relationsById.values()) {
      if (relation.from.nodeId === superType.baseNodeId) allowed.push(relation);
    }

    return allowed.sort((a: GRelation, b: GRelation): number => a.name.localeCompare(b.name));
  }

  public listToNodes(base: GModel, derived: GModel, baseRelationId: Id): ReadonlyArray<GNode> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const derivedIndex: GModelIndex = new GModelIndex(derived);

    const baseRelation: GRelation | undefined = baseIndex.relationsById.get(baseRelationId);
    if (!baseRelation) return [];

    const expectedToBaseId: Id = baseRelation.to.nodeId;
    const allowed: GNode[] = [];

    for (const node of derivedIndex.nodesById.values()) {
      const superType: BaseNode | null = SemanticHelper.getBaseSuperType(node, base.id);
      if (!superType) continue;
      if (superType.baseNodeId === expectedToBaseId) allowed.push(node);
    }

    return allowed.sort((a: GNode, b: GNode): number => a.name.localeCompare(b.name));
  }

  public groupDerivedNodesByBaseId(base: GModel, derived: GModel): ReadonlyMap<Id, ReadonlyArray<GNode>> {
    const derivedIndex: GModelIndex = new GModelIndex(derived);
    const grouped: Map<Id, GNode[]> = new Map<Id, GNode[]>();

    for (const node of derivedIndex.nodesById.values()) {
      const superType: BaseNode | null = SemanticHelper.getBaseSuperType(node, base.id);
      if (!superType) continue;

      const baseNodeId: Id = superType.baseNodeId;

      const list: GNode[] | undefined = grouped.get(baseNodeId);
      if (list) list.push(node);
      else grouped.set(baseNodeId, [node]);
    }

    for (const [baseNodeId, list] of grouped.entries()) {
      grouped.set(
        baseNodeId,
        list.sort((a: GNode, b: GNode): number => a.name.localeCompare(b.name)),
      );
    }

    return grouped;
  }

  public createDerivedNode(baseId: Id, input: CreateNodeInput): GNode {
    return {
      kind: 'GNode',
      id: SuggestionHelper.createIdentifier(),
      name: input.name,
      superTypes: [Refs.qualify(baseId, input.baseNodeId)],
      attributes: [],
      constraints: [],
      ext: {},
    };
  }

  public createDataType(input: CreateDataTypeInput): GDataType {
    return {
      kind: 'GDataType',
      id: SuggestionHelper.createIdentifier(),
      name: input.name,
      literals: undefined,
      constraints: [],
      ext: {},
    };
  }

  public createDerivedRelation(base: GModel, baseId: Id, input: CreateRelationInput): GRelation {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const baseRelation: GRelation | undefined = baseIndex.relationsById.get(input.baseRelationId);
    if (!baseRelation) throw new Error(`Base relation not found: ${input.baseRelationId}`);

    return {
      kind: 'GRelation',
      id: SuggestionHelper.createIdentifier(),
      superTypes: [Refs.qualify(baseId, input.baseRelationId)],
      name: baseRelation.name,
      from: {
        nodeId: input.fromNodeId,
        role: baseRelation.from.role,
        bounds: { ...baseRelation.from.bounds },
        constraints: [],
        ext: {},
      },
      to: {
        nodeId: input.toNodeId,
        role: baseRelation.to.role,
        bounds: { ...baseRelation.to.bounds },
        constraints: [],
        ext: {},
      },
      isBidirectional: baseRelation.isBidirectional,
      constraints: [],
      ext: {},
    };
  }

  public duplicateDerivedNode(source: GNode): GNode {
    const cloned: GNode = structuredClone(source);
    cloned.id = SuggestionHelper.createIdentifier();
    cloned.name = `${source.name} (copy)`;

    const constraintFn: (constraint: GConstraint) => GConstraint = (constraint: GConstraint): GConstraint => {
      return { ...constraint, id: SuggestionHelper.createIdentifier() };
    };
    cloned.constraints = cloned.constraints?.map(constraintFn);
    cloned.attributes = cloned.attributes.map((attribute: GAttribute): GAttribute => {
      return { ...attribute, constraints: attribute.constraints?.map(constraintFn) };
    });

    return cloned;
  }

  public duplicateConnectedNode(model: GModel, sourceNodeId: Id): ConnectedNode {
    const index: GModelIndex = new GModelIndex(model);
    const source: GNode | undefined = index.nodesById.get(sourceNodeId);
    if (!source) throw new Error(`Node not found: ${sourceNodeId}`);

    const clonedNode: GNode = this.duplicateDerivedNode(source);
    const related: GRelation[] = [];

    for (const relation of model.relations) {
      const isRelevant: boolean = relation.from.nodeId === sourceNodeId || relation.to.nodeId === sourceNodeId;
      if (!isRelevant) continue;

      const clonedRelation: GRelation = structuredClone(relation);
      clonedRelation.id = SuggestionHelper.createIdentifier();

      if (clonedRelation.from.nodeId === sourceNodeId) clonedRelation.from.nodeId = clonedNode.id;
      if (clonedRelation.to.nodeId === sourceNodeId) clonedRelation.to.nodeId = clonedNode.id;

      const constraintFn: (constraint: GConstraint) => GConstraint = (constraint: GConstraint): GConstraint => {
        return { ...constraint, id: SuggestionHelper.createIdentifier() };
      };

      clonedRelation.constraints = clonedRelation.constraints?.map(constraintFn);
      clonedRelation.from.constraints = clonedRelation.from.constraints?.map(constraintFn);
      clonedRelation.to.constraints = clonedRelation.to.constraints?.map(constraintFn);

      related.push(clonedRelation);
    }

    return { node: clonedNode, relations: related };
  }

  public static createIdentifier(): string {
    return new ShortUniqueId({ length: 16 }).rnd();
  }
}
