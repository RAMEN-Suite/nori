import { Bounds, GNode, GRelation } from '../../../models/GModel';
import { QualifiedRefParts, Refs } from '../container/References';
import { REGEXP } from '../../../const/REGEXP';

export type BaseNode = { baseId: string; baseNodeId: string };

export class SemanticValidationHelper {
  public static getBaseSuperType(node: GNode, baseId: string): BaseNode | null {
    const superTypes: string[] = node.superTypes ?? [];
    if (superTypes.length !== 1) return null;

    const superType: string = superTypes[0];
    if (!Refs.isQualified(superType)) return null;

    const parts: QualifiedRefParts = Refs.splitQualified(superType);
    if (parts.modelId !== baseId) return null;

    return { baseId: parts.modelId, baseNodeId: parts.nodeId };
  }

  public static getBaseQualifiedId(reference: string, baseId: string): string | null {
    if (!Refs.isQualified(reference)) return null;
    const parts: QualifiedRefParts = Refs.splitQualified(reference);
    if (parts.modelId !== baseId) return null;
    return parts.nodeId;
  }

  public static areBoundsCoherent(bounds: Bounds): boolean {
    if (bounds.lowerBound < 0) return false;
    if (bounds.upperBound === -1) return true;
    return bounds.upperBound >= bounds.lowerBound;
  }

  public static isDerivedBoundsCompatible(base: Bounds, derived: Bounds): boolean {
    if (!SemanticValidationHelper.areBoundsCoherent(derived)) return false;
    if (derived.lowerBound < base.lowerBound) return false;
    if (base.upperBound === -1) return true;
    if (derived.upperBound === -1) return false;
    return derived.upperBound <= base.upperBound;
  }

  public static areRelationEndsLocal(relation: GRelation): boolean {
    return !Refs.isQualified(relation.from.nodeId) && !Refs.isQualified(relation.to.nodeId);
  }

  public static getBaseRelationSuperTypeId(relation: GRelation, baseId: string): string | null {
    const superTypes: string[] = relation.superTypes ?? [];
    if (superTypes.length !== 1) return null;

    const superType: string = superTypes[0];
    if (!Refs.isQualified(superType)) return null;

    const parts: QualifiedRefParts = Refs.splitQualified(superType);
    if (parts.modelId !== baseId) return null;

    return parts.nodeId;
  }

  public static createRelationName(name: string): string | null {
    if (!name || !REGEXP.isValidRelation.test(name)) return null;

    const parts: string[] = name.split('_').filter((part: string): boolean => part.length > 0);
    if (parts.length === 0) return null;

    const firstPart: string = parts[0].toLowerCase();
    const remainingParts: string[] = parts.slice(1);

    return (
      firstPart +
      remainingParts
        .map((part: string): string => part.toLowerCase())
        .map((part: string): string => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    );
  }

  public static expectedRelationIdFromParts(
    name: string,
    fromNodeId: string,
    toNodeId: string,
  ): string | null {
    const camel: string | null = SemanticValidationHelper.createRelationName(name);
    if (!camel) return null;
    return `${fromNodeId}_${camel}_${toNodeId}`;
  }

  public static expectedRelationId(relation: GRelation): string | null {
    return SemanticValidationHelper.expectedRelationIdFromParts(
      relation.name,
      relation.from.nodeId,
      relation.to.nodeId,
    );
  }
}
