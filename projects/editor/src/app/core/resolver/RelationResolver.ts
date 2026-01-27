import { GModel, GRelation, Id, Ref } from '../models/GModel';
import { QualifiedParts, Reference } from '../validation/container/Reference';
import { GModelIndex } from '../validation/container/GModelIndex';

export class RelationResolver {
  public static resolveReservedRoleNames(
    startModelId: Id,
    nodeId: Id,
    modelsById: ReadonlyMap<Id, GModel>,
  ): ReadonlySet<string> {
    const reserved: Set<string> = new Set<string>();

    const model: GModel | undefined = modelsById.get(startModelId);
    if (!model) return reserved;

    const index: GModelIndex = new GModelIndex(model);
    for (const rel of index.relationsById.values()) {
      if (rel.from.nodeId === nodeId) reserved.add(rel.to.role);
      if (rel.to.nodeId === nodeId) reserved.add(rel.from.role);
    }

    return reserved;
  }

  public static resolveBaseRelationId(baseModelId: Id, relation: GRelation): Id | null {
    const superTypes: ReadonlyArray<Ref> = relation.superTypes ?? [];
    if (superTypes.length !== 1) return null;

    const superType: Ref = superTypes[0]!;
    if (!Reference.isQualified(superType)) return null;

    const parts: QualifiedParts = Reference.splitQualified(superType);
    if (parts.modelId !== baseModelId) return null;

    return parts.refId;
  }

  public static resolveBaseRelationName(base: GModel, relation: GRelation): string | null {
    const baseRelationId: Id | null = this.resolveBaseRelationId(base.id, relation);
    if (!baseRelationId) return null;

    const baseIndex: GModelIndex = new GModelIndex(base);
    return baseIndex.relationsById.get(baseRelationId)?.name ?? null;
  }
}
