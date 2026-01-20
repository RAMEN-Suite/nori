import { Bounds, GNode, GRelation, Id, Ref } from '../../models/GModel';
import { QualifiedRefParts, Refs } from '../container/References';

export type BaseNode = { baseId: Id; baseNodeId: Id };

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

  private static getQualifiedParts(
    superTypes: ReadonlyArray<Ref>,
    baseId: Id,
  ): QualifiedRefParts | null {
    if (superTypes.length !== 1) return null;

    const ref: Ref = superTypes[0]!;
    if (!Refs.isQualified(ref)) return null;

    const parts: QualifiedRefParts = Refs.splitQualified(ref);
    if (parts.modelId !== baseId) return null;

    return parts;
  }
}
