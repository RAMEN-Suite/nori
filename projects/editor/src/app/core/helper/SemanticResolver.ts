import { GModel, GNode, Id, Ref } from '../models/GModel';
import { QualifiedParts, Reference } from '../validation/container/Reference';
import { GModelIndex } from '../validation/container/GModelIndex';

export type BaseNode = {
  readonly modelId: Id;
  readonly node: GNode;
};

export class SemanticResolver {
  public static getQualifiedPartsFromRef(ref: Ref, baseModelId: Id): QualifiedParts | null {
    return this.getQualifiedParts([ref], baseModelId);
  }

  public static getQualifiedPartsFromNode(node: GNode, baseModelId: Id): QualifiedParts | null {
    return this.getQualifiedParts(node.superTypes, baseModelId);
  }

  public static getBaseNodeChain(
    startModelId: Id,
    startNodeId: Id,
    modelsById: ReadonlyMap<Id, GModel>,
  ): ReadonlyArray<BaseNode> {
    const chain: BaseNode[] = [];
    const visited: Set<string> = new Set<string>();

    let currentModelId: Id = startModelId;
    let currentNodeId: Id = startNodeId;

    while (true) {
      const visitKey: string = `${currentModelId}:${currentNodeId}`;
      if (visited.has(visitKey)) throw Error(`Cyclic superType chain detected at '${visitKey}'`);
      visited.add(visitKey);

      const currentModel: GModel | undefined = modelsById.get(currentModelId);
      if (!currentModel) break;

      const currentIndex: GModelIndex = new GModelIndex(currentModel);
      const currentNode: GNode | undefined = currentIndex.nodesById.get(currentNodeId);
      if (!currentNode) break;

      chain.push({ modelId: currentModelId, node: currentNode });

      const superTypes: ReadonlyArray<Ref> = currentNode.superTypes;
      if (superTypes.length === 0 || !superTypes[0]) break;
      if (superTypes.length !== 1) throw Error(`Invalid superTypes for '${currentNodeId}' expected(1).`);

      const superType: Ref = superTypes[0];
      if (Reference.isQualified(superType)) {
        const parts: QualifiedParts = Reference.splitQualified(superType);
        currentModelId = parts.modelId;
        currentNodeId = parts.nodeId;
      } else currentNodeId = superType;
    }

    return chain.slice(1).reverse();
  }

  private static getQualifiedParts(superTypes: ReadonlyArray<Ref>, baseModelId: Id): QualifiedParts | null {
    if (superTypes.length !== 1) return null;

    const ref: Ref = superTypes[0]!;
    if (!Reference.isQualified(ref)) return null;

    const parts: QualifiedParts = Reference.splitQualified(ref);
    if (parts.modelId !== baseModelId) return null;

    return parts;
  }
}
