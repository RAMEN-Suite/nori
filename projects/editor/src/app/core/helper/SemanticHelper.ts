import { Bounds, GRelation } from '../models/GModel';
import { Reference } from '../validation/container/Reference';

export class SemanticHelper {
  private static readonly UNBOUNDED = -1 as const;

  public static areBoundsCoherent(bounds: Bounds): boolean {
    if (bounds.lowerBound < 0) return false;
    if (bounds.upperBound === this.UNBOUNDED) return true;
    return bounds.upperBound >= bounds.lowerBound;
  }

  public static isModelBoundsCompatible(base: Bounds, model: Bounds): boolean {
    if (!this.areBoundsCoherent(model)) return false;
    if (model.lowerBound < base.lowerBound) return false;
    if (base.upperBound === this.UNBOUNDED) return true;
    if (model.upperBound === this.UNBOUNDED) return false;
    return model.upperBound <= base.upperBound;
  }

  public static areRelationEndsLocal(relation: GRelation): boolean {
    return !Reference.isQualified(relation.from.nodeId) && !Reference.isQualified(relation.to.nodeId);
  }
}
