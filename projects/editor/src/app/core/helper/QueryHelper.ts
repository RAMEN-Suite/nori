import { GDataType, GModel, GNode, GRelation, Id } from '../models/GModel';
import { GModelIndex } from '../validation/container/GModelIndex';
import { QualifiedParts, Reference } from '../validation/container/Reference';
import { NodeResolver, ResolvedNode } from '../resolver/NodeResolver';
import { ModelResolver } from '../resolver/ModelResolver';

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
    const grouped: Map<Id, GNode[]> = new Map<Id, GNode[]>();

    for (const node of modelIndex.nodesById.values()) {
      const superType: QualifiedParts | null = NodeResolver.resolveLocalSuperType(node.superTypes, base.id);
      if (!superType) continue;

      const baseNodeId: Id = superType.refId;
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

  public static listRelations(model: GModel): ReadonlyArray<GRelation> {
    const modelIndex: GModelIndex = new GModelIndex(model);
    const relations: GRelation[] = Array.from(modelIndex.relationsById.values());
    return relations.sort((a: GRelation, b: GRelation): number => a.name.localeCompare(b.name));
  }

  public static listRelationsFrom(base: GModel, model: GModel, fromNodeId: Id): ReadonlyArray<GRelation> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const modelIndex: GModelIndex = new GModelIndex(model);

    const fromNode: GNode | undefined = modelIndex.nodesById.get(fromNodeId);
    if (!fromNode) return [];

    const superType: QualifiedParts | null = NodeResolver.resolveLocalSuperType(fromNode.superTypes, base.id);
    if (!superType) return [];

    const allowed: GRelation[] = [];
    for (const relation of baseIndex.relationsById.values()) {
      if (relation.from.nodeId === superType.refId) allowed.push(relation);
    }

    return allowed.sort((a: GRelation, b: GRelation): number => a.name.localeCompare(b.name));
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
