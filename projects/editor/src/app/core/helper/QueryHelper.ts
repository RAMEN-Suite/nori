import { GDataType, GModel, GNode, GRelation, Id, Import } from '../models/GModel';
import { GModelIndex } from '../validation/container/GModelIndex';
import { QualifiedParts, Reference } from '../validation/container/Reference';
import { BaseNode, SemanticResolver } from './SemanticResolver';

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
  ): ReadonlyArray<BaseNode> {
    try {
      return SemanticResolver.getBaseNodeChain(startModelId, startNodeId, modelsById);
    } catch (error: unknown) {
      console.error(error);
      return [];
    }
  }

  public static listGroupedNodesByBaseId(base: GModel, model: GModel): ReadonlyMap<Id, ReadonlyArray<GNode>> {
    const derivedIndex: GModelIndex = new GModelIndex(model);
    const grouped: Map<Id, GNode[]> = new Map<Id, GNode[]>();

    for (const node of derivedIndex.nodesById.values()) {
      const superType: QualifiedParts | null = SemanticResolver.getQualifiedPartsFromNode(node, base.id);
      if (!superType) continue;

      const baseNodeId: Id = superType.nodeId;
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
    const derivedIndex: GModelIndex = new GModelIndex(model);

    const fromNode: GNode | undefined = derivedIndex.nodesById.get(fromNodeId);
    if (!fromNode) return [];

    const superType: QualifiedParts | null = SemanticResolver.getQualifiedPartsFromNode(fromNode, base.id);
    if (!superType) return [];

    const allowed: GRelation[] = [];
    for (const relation of baseIndex.relationsById.values()) {
      if (relation.from.nodeId === superType.nodeId) allowed.push(relation);
    }

    return allowed.sort((a: GRelation, b: GRelation): number => a.name.localeCompare(b.name));
  }

  public static listRelationToNodes(base: GModel, model: GModel, baseRelationId: Id): ReadonlyArray<GNode> {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const derivedIndex: GModelIndex = new GModelIndex(model);

    const baseRelation: GRelation | undefined = baseIndex.relationsById.get(baseRelationId);
    if (!baseRelation) return [];

    const expectedToBaseId: Id = baseRelation.to.nodeId;
    const allowed: GNode[] = [];

    for (const node of derivedIndex.nodesById.values()) {
      const superType: QualifiedParts | null = SemanticResolver.getQualifiedPartsFromNode(node, base.id);
      if (!superType) continue;
      if (superType.nodeId === expectedToBaseId) allowed.push(node);
    }

    return allowed.sort((a: GNode, b: GNode): number => a.name.localeCompare(b.name));
  }

  public static listDataTypes(model: GModel): ReadonlyArray<GDataType> {
    const modelIndex: GModelIndex = new GModelIndex(model);
    const types: GDataType[] = Array.from(modelIndex.dataTypesById.values());
    return types.sort((a: GDataType, b: GDataType): number => a.name.localeCompare(b.name));
  }

  public static listGlobalDataTypes(
    base: GModel,
    model: GModel,
    modelsById?: ReadonlyMap<Id, GModel>,
  ): ReadonlyArray<GDataType> {
    if (!modelsById) return this.listBaseDataTypes(base, model);
    const closure: ReadonlyArray<GModel> = this.getImportClosure(model.id, modelsById);

    const derivedIndex: GModelIndex = new GModelIndex(model);
    const available: GDataType[] = [...derivedIndex.dataTypesById.values()];

    for (const model of closure) {
      if (model.id === model.id) continue;

      const index: GModelIndex = new GModelIndex(model);
      for (const dataType of index.dataTypesById.values()) {
        available.push({ ...dataType, id: Reference.qualify(model.id, dataType.id) });
      }
    }
    return available.sort((a: GDataType, b: GDataType): number => a.name.localeCompare(b.name));
  }

  private static listBaseDataTypes(base: GModel, derived: GModel): ReadonlyArray<GDataType> {
    const baseIndex = new GModelIndex(base);
    const derivedIndex = new GModelIndex(derived);
    const types: GDataType[] = [...derivedIndex.dataTypesById.values()];

    for (const dataType of baseIndex.dataTypesById.values()) {
      types.push({ ...dataType, id: Reference.qualify(base.id, dataType.id) });
    }

    return types.sort((a: GDataType, b: GDataType): number => a.name.localeCompare(b.name));
  }

  private static getImportClosure(startModelId: Id, modelsById: ReadonlyMap<Id, GModel>): ReadonlyArray<GModel> {
    const result: GModel[] = [];
    const visited: Set<Id> = new Set<Id>();
    const queue: Id[] = [startModelId];

    while (queue.length > 0) {
      const currentId: Id = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const model: GModel | undefined = modelsById.get(currentId);
      if (!model) continue;

      result.push(model);

      const imports: Import[] = model.imports ?? [];
      for (const imp of imports) {
        if (!visited.has(imp.modelId)) queue.push(imp.modelId);
      }
    }

    return result;
  }
}
