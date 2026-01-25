import { Bounds, GRelation } from '../models/GModel';
import { Reference } from '../validation/container/Reference';

export class SemanticHelper {
  private static readonly UNBOUNDED = -1 as const;

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
    return !Reference.isQualified(relation.from.nodeId) && !Reference.isQualified(relation.to.nodeId);
  }
}
