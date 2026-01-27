import { GAttribute, GModel, GNode, Id, Ref } from '../models/GModel';
import { QualifiedParts, Reference } from '../validation/container/Reference';
import { GModelIndex } from '../validation/container/GModelIndex';

export type ResolvedNode = {
  readonly modelId: Id;
  readonly node: GNode;
};

export class NodeResolver {
  public static resolveLocalSuperType(superTypes: ReadonlyArray<Ref>, baseModelId: Id): QualifiedParts | null {
    if (superTypes.length !== 1) return null;

    const ref: Ref = superTypes[0]!;
    if (!Reference.isQualified(ref)) return null;

    const parts: QualifiedParts = Reference.splitQualified(ref);
    if (parts.modelId !== baseModelId) return null;

    return parts;
  }

  public static resolveSuperTypeChain(
    startModelId: Id,
    startNodeId: Id,
    modelsById: ReadonlyMap<Id, GModel>,
  ): ReadonlyArray<ResolvedNode> {
    const superTypeChain: ResolvedNode[] = [];
    const visitedNode: Set<string> = new Set<string>();

    let currentModelId: Id = startModelId;
    let currentNodeId: Id = startNodeId;

    while (true) {
      const visitKey: string = `${currentModelId}:${currentNodeId}`;
      if (visitedNode.has(visitKey)) throw Error(`Cyclic superType chain detected at '${visitKey}'`);
      visitedNode.add(visitKey);

      const currentModel: GModel | undefined = modelsById.get(currentModelId);
      if (!currentModel) break;

      const currentIndex: GModelIndex = new GModelIndex(currentModel);
      const currentNode: GNode | undefined = currentIndex.nodesById.get(currentNodeId);
      if (!currentNode) break;

      superTypeChain.push({ modelId: currentModelId, node: currentNode });

      const superTypes: ReadonlyArray<Ref> = currentNode.superTypes;
      if (superTypes.length === 0 || !superTypes[0]) break;
      if (superTypes.length !== 1) throw Error(`Invalid superTypes for '${currentNodeId}' expected(1).`);
      const superType: Ref = superTypes[0];

      if (Reference.isQualified(superType)) {
        const parts: QualifiedParts = Reference.splitQualified(superType);
        currentModelId = parts.modelId;
        currentNodeId = parts.refId;
      } else currentNodeId = superType;
    }

    return superTypeChain.slice(1).reverse();
  }

  public static resolveAttributeNames(
    startModelId: Id,
    startNodeId: Id,
    modelsById: ReadonlyMap<Id, GModel>,
  ): ReadonlySet<string> {
    const attributeNames: Set<string> = new Set<string>();
    const startModel: GModel | undefined = modelsById.get(startModelId);

    if (startModel) {
      const index: GModelIndex = new GModelIndex(startModel);
      const node: GNode | undefined = index.nodesById.get(startNodeId);
      if (node) for (const attribute of node.attributes ?? []) attributeNames.add(attribute.name);
    }

    const inherited: ReadonlySet<string> = this.resolveInheritedAttributeNames(startModelId, startNodeId, modelsById);
    for (const name of inherited) attributeNames.add(name);
    return attributeNames;
  }

  public static resolveInheritedAttributeNames(
    startModelId: Id,
    startNodeId: Id,
    modelsById: ReadonlyMap<Id, GModel>,
  ): ReadonlySet<string> {
    const attributeNames: Set<string> = new Set<string>();
    const chain: ReadonlyArray<ResolvedNode> = this.resolveSuperTypeChain(startModelId, startNodeId, modelsById);

    for (const item of chain) {
      const attributes: ReadonlyArray<GAttribute> = item.node.attributes ?? [];

      for (const attribute of attributes) {
        attributeNames.add(attribute.name);
      }
    }

    return attributeNames;
  }

  public static resolveRelationRoles(
    startModelId: Id,
    startNodeId: Id,
    modelsById: ReadonlyMap<Id, GModel>,
  ): ReadonlySet<string> {
    const roleNames: Set<string> = new Set<string>();
    const startModel: GModel | undefined = modelsById.get(startModelId);
    if (!startModel) return roleNames;

    for (const relation of startModel.relations ?? []) {
      if (relation.from.nodeId === startNodeId) roleNames.add(relation.to.role);
      if (relation.to.nodeId === startNodeId) roleNames.add(relation.from.role);
    }

    return roleNames;
  }
}
