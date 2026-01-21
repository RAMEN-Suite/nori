import { Bounds, GModel, GNode, GRelation, Id, Ref } from '../models/GModel';
import { QualifiedRefParts, Refs } from '../validation/container/References';
import { GModelIndex } from '../validation/container/GModelIndex';

export type BaseNode = { baseId: Id; baseNodeId: Id };

export type SuperTypeChainItem = {
  readonly modelId: Id;
  readonly node: GNode;
};

export class SemanticHelper {
  private static readonly UNBOUNDED = -1 as const;

  public static getBaseQualifiedId(reference: Ref, baseId: Id): Id | null {
    if (!Refs.isQualified(reference)) return null;
    const parts: QualifiedRefParts = Refs.splitQualified(reference);
    if (parts.modelId !== baseId) return null;
    return parts.nodeId;
  }

  public static areBoundsCoherent(bounds: Bounds): boolean {
    if (bounds.lowerBound < 0) return false;
    if (bounds.upperBound === this.UNBOUNDED) return true;
    return bounds.upperBound >= bounds.lowerBound;
  }

  public static isDerivedBoundsCompatible(base: Bounds, derived: Bounds): boolean {
    if (!this.areBoundsCoherent(derived)) return false;
    if (derived.lowerBound < base.lowerBound) return false;
    if (base.upperBound === this.UNBOUNDED) return true;
    if (derived.upperBound === this.UNBOUNDED) return false;
    return derived.upperBound <= base.upperBound;
  }

  public static areRelationEndsLocal(relation: GRelation): boolean {
    return !Refs.isQualified(relation.from.nodeId) && !Refs.isQualified(relation.to.nodeId);
  }

  public static getBaseSuperType(node: GNode, baseId: Id): BaseNode | null {
    const parts: QualifiedRefParts | null = this.getQualifiedParts(node.superTypes, baseId);
    if (!parts) return null;
    return { baseId: parts.modelId, baseNodeId: parts.nodeId };
  }

  public static getBaseRelationSuperTypeId(relation: GRelation, baseId: Id): Id | null {
    const parts: QualifiedRefParts | null = this.getQualifiedParts(relation.superTypes, baseId);
    return parts?.nodeId ?? null;
  }

  private static getQualifiedParts(superTypes: ReadonlyArray<Ref>, baseId: Id): QualifiedRefParts | null {
    if (superTypes.length !== 1) return null;

    const ref: Ref = superTypes[0]!;
    if (!Refs.isQualified(ref)) return null;

    const parts: QualifiedRefParts = Refs.splitQualified(ref);
    if (parts.modelId !== baseId) return null;

    return parts;
  }

  public static getSuperTypeChain(
    startModelId: Id,
    startNodeId: Id,
    modelsById: ReadonlyMap<Id, GModel>,
  ): ReadonlyArray<SuperTypeChainItem> {
    const chain: SuperTypeChainItem[] = [];
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
      if (Refs.isQualified(superType)) {
        const parts: QualifiedRefParts = Refs.splitQualified(superType);
        currentModelId = parts.modelId;
        currentNodeId = parts.nodeId;
      } else currentNodeId = superType;
    }

    return chain.slice(1).reverse();
  }
}
