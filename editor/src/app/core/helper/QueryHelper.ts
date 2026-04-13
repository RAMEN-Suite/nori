import { GDataType, GModel, GNode, GRelation, Id } from '../models/GModel';
import { GModelIndex } from '../validation/container/GModelIndex';
import { QualifiedParts, Reference } from '../validation/container/Reference';
import { NodeResolver, ResolvedNode } from '../resolver/NodeResolver';
import { ModelResolver } from '../resolver/ModelResolver';

export type Direction = 'OUT' | 'IN';
export type SelectableRelation = {
  readonly baseRelationId: Id;
  readonly relationName: string;
  readonly roleName: string;
  readonly direction: Direction;
};

export class QueryHelper {
  public static listNodes(model: GModel): ReadonlyArray<GNode> {
    const modelIndex: GModelIndex = new GModelIndex(model);
    const nodes: GNode[] = Array.from(modelIndex.nodesById.values());
    return nodes.sort((a: GNode, b: GNode): number => a.name.localeCompare(b.name));
  }

  public static listNodeChain(
    startModelId: string,
    startNodeId: string,
    modelsById: ReadonlyMap<Id, GModel>,
  ): ReadonlyArray<ResolvedNode> {
    try {
      return NodeResolver.resolveSuperTypeChain(startModelId, startNodeId, modelsById);
    } catch (error: unknown) {
      console.error(error);
      return [];
    }
  }

  public static listGroupedNodesByBaseId(base: GModel, model: GModel): ReadonlyMap<Id, ReadonlyArray<GNode>> {
    const modelIndex: GModelIndex = new GModelIndex(model);
    const groupedNodes: Map<Id, GNode[]> = new Map<Id, GNode[]>();

    for (const node of modelIndex.nodesById.values()) {
      const superType: QualifiedParts | null = NodeResolver.resolveLocalSuperType(node.superTypes, base.id);
      if (!superType) continue;

      const refId: Id = superType.refId;
      const list: GNode[] | undefined = groupedNodes.get(refId);

      if (list) list.push(node);
      else groupedNodes.set(refId, [node]);
    }

    for (const [baseNodeId, list] of groupedNodes.entries()) {
      groupedNodes.set(
        baseNodeId,
        list.sort((a: GNode, b: GNode): number => a.name.localeCompare(b.name)),
      );
    }
    return groupedNodes;
  }

  public static listRelations(model: GModel): ReadonlyArray<GRelation> {
    const modelIndex: GModelIndex = new GModelIndex(model);
    const relations: GRelation[] = Array.from(modelIndex.relationsById.values());
    return relations.sort((a: GRelation, b: GRelation): number => a.name.localeCompare(b.name));
  }

  public static listSelectableRelations(base: GModel, model: GModel, nodeId: Id): ReadonlyArray<SelectableRelation> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const modelIndex: GModelIndex = new GModelIndex(model);

    const node: GNode | undefined = modelIndex.nodesById.get(nodeId);
    if (!node) return [];

    const superType: QualifiedParts | null = NodeResolver.resolveLocalSuperType(node.superTypes, base.id);
    if (!superType) return [];

    const baseNodeId: Id = superType.refId;
    const relations: SelectableRelation[] = [];

    for (const relation of baseIndex.relationsById.values()) {
      if (relation.from.nodeId === baseNodeId) {
        relations.push({
          baseRelationId: relation.id,
          relationName: relation.name,
          direction: 'OUT',
          roleName: relation.to.role,
        });
      }

      if (relation.to.nodeId === baseNodeId) {
        relations.push({
          baseRelationId: relation.id,
          relationName: relation.name,
          direction: 'IN',
          roleName: relation.from.role,
        });
      }
    }

    return relations.sort((a: SelectableRelation, b: SelectableRelation): number =>
      a.relationName.localeCompare(b.relationName),
    );
  }

  public static listRelationRoles(model: GModel, nodeId: Id): ReadonlySet<string> {
    const roles: Set<string> = new Set<string>();

    for (const relation of model.relations ?? []) {
      if (relation.from.nodeId === nodeId) roles.add(relation.to.role);
      if (relation.to.nodeId === nodeId) roles.add(relation.from.role);
    }

    return roles;
  }

  public static listRelationFromNodes(base: GModel, model: GModel, baseRelationId: Id): ReadonlyArray<GNode> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const modelIndex: GModelIndex = new GModelIndex(model);

    const baseRelation: GRelation | undefined = baseIndex.relationsById.get(baseRelationId);
    if (!baseRelation) return [];

    const expectedFromBaseId: Id = baseRelation.from.nodeId;
    const allowed: GNode[] = [];

    for (const node of modelIndex.nodesById.values()) {
      const superType: QualifiedParts | null = NodeResolver.resolveLocalSuperType(node.superTypes, base.id);
      if (!superType) continue;
      if (superType.refId === expectedFromBaseId) allowed.push(node);
    }

    return allowed.sort((a: GNode, b: GNode): number => a.name.localeCompare(b.name));
  }

  public static listRelationToNodes(base: GModel, model: GModel, baseRelationId: Id): ReadonlyArray<GNode> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const modelIndex: GModelIndex = new GModelIndex(model);

    const baseRelation: GRelation | undefined = baseIndex.relationsById.get(baseRelationId);
    if (!baseRelation) return [];

    const expectedToBaseId: Id = baseRelation.to.nodeId;
    const allowed: GNode[] = [];

    for (const node of modelIndex.nodesById.values()) {
      const superType: QualifiedParts | null = NodeResolver.resolveLocalSuperType(node.superTypes, base.id);
      if (!superType) continue;
      if (superType.refId === expectedToBaseId) allowed.push(node);
    }

    return allowed.sort((a: GNode, b: GNode): number => a.name.localeCompare(b.name));
  }

  public static listDataTypes(model: GModel): ReadonlyArray<GDataType> {
    const modelIndex: GModelIndex = new GModelIndex(model);
    const types: GDataType[] = Array.from(modelIndex.dataTypesById.values());
    return types.sort((a: GDataType, b: GDataType): number => a.name.localeCompare(b.name));
  }

  public static listGlobalDataTypes(model: GModel, modelsById: ReadonlyMap<Id, GModel>): ReadonlyArray<GDataType> {
    const closures: ReadonlyArray<GModel> = ModelResolver.resolveImports(model.id, modelsById);
    const modelIndex: GModelIndex = new GModelIndex(model);
    const available: GDataType[] = [...modelIndex.dataTypesById.values()];

    for (const closure of closures) {
      if (closure.id === model.id) continue;

      const index: GModelIndex = new GModelIndex(closure);
      for (const dataType of index.dataTypesById.values()) {
        available.push({ ...dataType, id: Reference.qualify(closure.id, dataType.id) });
      }
    }
    return available.sort((a: GDataType, b: GDataType): number => a.name.localeCompare(b.name));
  }
}
