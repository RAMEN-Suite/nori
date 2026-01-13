import { Bounds, GAttribute, GDataType, GModel, GNode, GRelation } from '../../../models/GModel';
import { GModelIndex } from '../container/GModelIndex';
import { BaseNode, StrictRules } from '../rules/StrictRules';
import { Builtins, Refs } from '../container/References';

export interface CreateNodeInput {
  readonly name: string;
  readonly baseNodeId: string;
}

export interface CreateRelationInput {
  readonly baseRelationId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
}

export interface CreateAttributeInput {
  readonly name: string;
  readonly typeId: string;
  readonly bounds?: Bounds;
}

export interface CreateDataTypeInput {
  readonly name: string;
}
export interface RelationCandidate {
  readonly baseRelationId: string;
  readonly baseRelation: GRelation;
  readonly fromNodeId: string;
  readonly toNodeId: string;
}

export class SuggestionHelper {
  public listBaseNodes(base: GModel): ReadonlyArray<GNode> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const nodes: GNode[] = Array.from(baseIndex.nodesById.values());
    return nodes.sort((a: GNode, b: GNode): number => a.name.localeCompare(b.name));
  }

  public listBaseRelations(base: GModel): ReadonlyArray<GRelation> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const relations: GRelation[] = Array.from(baseIndex.relationsById.values());
    return relations.sort((a: GRelation, b: GRelation): number => a.name.localeCompare(b.name));
  }

  public listDataTypes(base: GModel, derived: GModel, baseAlias: string): ReadonlyArray<GDataType> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const derivedIndex: GModelIndex = new GModelIndex(derived);
    const types: GDataType[] = [];

    for (const id of Builtins.set.values()) {
      types.push({
        kind: 'GDataType',
        id: id,
        name: id,
        constraints: [],
        ext: {},
      });
    }

    for (const dataType of derivedIndex.dataTypesById.values()) types.push(dataType);

    for (const dataType of baseIndex.dataTypesById.values()) {
      types.push({
        ...dataType,
        id: Refs.qualify(baseAlias, dataType.id),
        name: dataType.name,
      });
    }

    types.sort((a: GDataType, b: GDataType): number => a.name.localeCompare(b.name));
    return types;
  }

  public listForbiddenAttributeNames(
    base: GModel,
    derived: GModel,
    baseAlias: string,
    nodeId: string,
  ): ReadonlySet<string> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const derivedIndex: GModelIndex = new GModelIndex(derived);

    const node: GNode | undefined = derivedIndex.nodesById.get(nodeId);
    if (!node) return new Set<string>();

    const forbidden: Set<string> = new Set<string>();
    const superType: BaseNode | null = StrictRules.getSingleBaseSupertype(node, baseAlias);

    if (superType) {
      const baseNode: GNode | undefined = baseIndex.nodesById.get(superType.baseNodeId);
      const baseAttributes: GAttribute[] = baseNode?.attributes ?? [];
      for (const attribute of baseAttributes) forbidden.add(attribute.name);
    }

    const ownAttributes: GAttribute[] = node.attributes ?? [];
    for (const attribute of ownAttributes) forbidden.add(attribute.name);

    return forbidden;
  }

  public listAllowedFromRelations(
    base: GModel,
    derived: GModel,
    baseAlias: string,
    fromNodeId: string,
  ): ReadonlyArray<GRelation> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const derivedIndex: GModelIndex = new GModelIndex(derived);

    const fromNode: GNode | undefined = derivedIndex.nodesById.get(fromNodeId);
    if (!fromNode) return [];

    const fromSuperType: BaseNode | null = StrictRules.getSingleBaseSupertype(fromNode, baseAlias);
    if (!fromSuperType) return [];

    const allowed: GRelation[] = [];

    for (const relation of baseIndex.relationsById.values()) {
      if (relation.from.nodeId === fromSuperType.baseNodeId) {
        allowed.push(relation);
      }
    }

    allowed.sort((a: GRelation, b: GRelation): number => a.name.localeCompare(b.name));
    return allowed;
  }

  public listAllowedToNodes(
    base: GModel,
    derived: GModel,
    baseAlias: string,
    baseRelationId: string,
  ): ReadonlyArray<GNode> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const derivedIndex: GModelIndex = new GModelIndex(derived);

    const baseRelation: GRelation | undefined = baseIndex.relationsById.get(baseRelationId);
    if (!baseRelation) return [];

    const expectedToBaseId: string = baseRelation.to.nodeId;
    const allowed: GNode[] = [];

    for (const node of derivedIndex.nodesById.values()) {
      const superType: BaseNode | null = StrictRules.getSingleBaseSupertype(node, baseAlias);
      if (!superType) continue;
      if (superType.baseNodeId === expectedToBaseId) allowed.push(node);
    }

    allowed.sort((a: GNode, b: GNode): number => a.name.localeCompare(b.name));
    return allowed;
  }

  public filterDerivedNodes(
    derived: GModel,
    baseAlias: string,
    baseNodeId: string,
  ): ReadonlyArray<GNode> {
    const derivedIndex: GModelIndex = new GModelIndex(derived);
    const nodes: GNode[] = [];

    for (const node of derivedIndex.nodesById.values()) {
      const superType: BaseNode | null = StrictRules.getSingleBaseSupertype(node, baseAlias);
      if (!superType) continue;
      if (superType.baseNodeId === baseNodeId) nodes.push(node);
    }

    return nodes.sort((a: GNode, b: GNode): number => a.name.localeCompare(b.name));
  }

  public createDerivedNode(baseAlias: string, input: CreateNodeInput): GNode {
    return {
      kind: 'GNode',
      id: this.createIdentifier(input.name),
      name: input.name,
      superTypes: [Refs.qualify(baseAlias, input.baseNodeId)],
      attributes: [],
      constraints: [],
      ext: {},
    };
  }

  public createAttribute(input: CreateAttributeInput): GAttribute {
    return {
      name: input.name,
      typeId: input.typeId,
      bounds: input.bounds ?? { lowerBound: 0, upperBound: 1 },
      constraints: [],
      ext: {},
    };
  }

  public createDataType(input: CreateDataTypeInput): GDataType {
    return {
      kind: 'GDataType',
      id: this.createIdentifier(input.name),
      name: input.name,
      literals: undefined,
      constraints: [],
      ext: {},
    };
  }

  public createDerivedRelation(
    base: GModel,
    baseAlias: string,
    input: CreateRelationInput,
  ): GRelation {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const baseRelation: GRelation | undefined = baseIndex.relationsById.get(input.baseRelationId);
    if (!baseRelation) throw new Error(`Base relation not found: ${input.baseRelationId}`);

    return {
      kind: 'GRelation',
      id: Refs.qualify(baseAlias, input.baseRelationId),
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

  private createIdentifier(name: string): string {
    if (!name) return '';

    const words: string[] = name
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean);

    if (words.length === 0) return '';
    const [first, ...rest] = words;

    return (
      first.toLowerCase() +
      rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
    );
  }
}
