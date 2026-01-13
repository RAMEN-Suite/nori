import { Bounds, GNode, GRelation } from '../../../models/GModel';
import { QualifiedRefParts, Refs } from '../container/References';

export type BaseNode = { baseAlias: string; baseNodeId: string };

export class StrictRules {
  public static getSingleBaseSupertype(node: GNode, baseAlias: string): BaseNode | null {
    const superTypes: string[] = node.superTypes;
    if (superTypes.length !== 1) return null;

    const superType: string = superTypes[0];
    if (!Refs.isQualified(superType)) return null;

    const parts: QualifiedRefParts = Refs.splitQualified(superType);
    if (parts.alias !== baseAlias) return null;

    return { baseAlias: parts.alias, baseNodeId: parts.id };
  }

  public static getBaseRelationId(derivedRelationId: string, baseAlias: string): string | null {
    if (!Refs.isQualified(derivedRelationId)) return null;
    const { alias, id } = Refs.splitQualified(derivedRelationId);
    return alias === baseAlias ? id : null;
  }

  public static areRelationEndsLocal(relation: GRelation): boolean {
    const isFromQualified: boolean = Refs.isQualified(relation.from.nodeId);
    const isToQualified: boolean = Refs.isQualified(relation.to.nodeId);
    return !isFromQualified && !isToQualified;
  }

  public static isDerivedBoundsCompatible(base: Bounds, derived: Bounds): boolean {
    if (derived.upperBound !== -1 && derived.upperBound < derived.lowerBound) return false;
    if (derived.lowerBound < base.lowerBound) return false;
    if (base.upperBound === -1) return true;
    if (derived.upperBound === -1) return false;
    return derived.upperBound <= base.upperBound;
  }

  public static getBaseTypeId(ref: string, baseAlias: string): string | null {
    const isQualified: boolean = Refs.isQualified(ref);
    if (!isQualified) return null;

    const parts: QualifiedRefParts = Refs.splitQualified(ref);
    if (parts.alias !== baseAlias) return null;

    return parts.id;
  }
}
