import { GRelation, Id, Ref } from '../../models/GModel';
import { Diagnostic, DiagnosticPath, Diagnostics } from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { ValidationContext } from '../SemanticValidator';
import { QualifiedParts, Reference } from '../container/Reference';
import { AbstractRules } from './AbstractRules';
import { RelationEndRules } from './RelationEndRules';

type BaseRelationResolution = {
  readonly baseRelationId: Id | null;
  readonly diagnostics: Diagnostic[];
};

export class RelationRules extends AbstractRules {
  private readonly endRules: RelationEndRules = new RelationEndRules();

  public validate(ctx: ValidationContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const relations: ReadonlyArray<GRelation> = ctx.derivedModel.relations ?? [];
    diagnostics.push(...this.validateUniqueIds(relations));

    relations.forEach((relation: GRelation, relationIndex: number): void => {
      const relationPath: DiagnosticPath = DiagnosticPath.root().property('relations').index(relationIndex);

      const resolution: BaseRelationResolution = this.resolveBaseRelationId(ctx, relation, relationPath);
      diagnostics.push(...resolution.diagnostics);
      if (!resolution.baseRelationId) return;

      const baseRelation: GRelation | undefined = ctx.baseIndex.relationsById.get(resolution.baseRelationId);
      diagnostics.push(...this.validateBaseRelationExists(resolution.baseRelationId, baseRelation, relationPath));
      if (!baseRelation) return;

      diagnostics.push(...this.validateComposite(relation, baseRelation, relationPath));
      diagnostics.push(...this.endRules.validate(ctx, relation, baseRelation, relationPath));
    });

    return diagnostics;
  }

  private validateUniqueIds(relations: ReadonlyArray<GRelation>): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const firstIndexById: Map<Id, number> = new Map<Id, number>();

    relations.forEach((relation: GRelation, relationIndex: number): void => {
      const previousIndex: number | undefined = firstIndexById.get(relation.id);
      if (previousIndex === undefined) {
        firstIndexById.set(relation.id, relationIndex);
        return;
      }

      diagnostics.push(
        Diagnostics.error({
          code: VALIDATION_ERROR.RELATION_ID_DUPLICATE,
          message: `Duplicate relation id '${relation.id}' (also at index ${previousIndex}).`,
          path: DiagnosticPath.root().property('relations').index(relationIndex).property('id'),
          ref: relation.id,
        }),
      );
    });

    return diagnostics;
  }

  private resolveBaseRelationId(
    ctx: ValidationContext,
    relation: GRelation,
    relationPath: DiagnosticPath,
  ): BaseRelationResolution {
    const diagnostics: Diagnostic[] = [];
    const superTypes: ReadonlyArray<Ref> = relation.superTypes ?? [];

    diagnostics.push(...this.validateRelationSuperTypeCardinality(ctx, relation, superTypes, relationPath));
    if (superTypes.length !== 1) return { baseRelationId: null, diagnostics };

    const superType: Ref = superTypes[0]!;
    diagnostics.push(...this.validateRelationSuperTypeQualified(ctx, relation, superType, relationPath));
    if (!Reference.isQualified(superType)) return { baseRelationId: null, diagnostics };

    const parts: QualifiedParts = Reference.splitQualified(superType);
    diagnostics.push(...this.validateRelationSuperTypeReferencesBase(ctx, relation, parts, relationPath));
    if (parts.modelId !== ctx.baseId) return { baseRelationId: null, diagnostics };

    return { baseRelationId: parts.refId, diagnostics };
  }

  private validateRelationSuperTypeCardinality(
    ctx: ValidationContext,
    relation: GRelation,
    superTypes: ReadonlyArray<Ref>,
    relationPath: DiagnosticPath,
  ): Diagnostic[] {
    if (superTypes.length === 1) return [];

    return [
      Diagnostics.error({
        code: VALIDATION_ERROR.RELATION_SUPERTYPE_CARDINALITY_INVALID,
        message: `Relation '${relation.id}' must declare exactly one base superType (${ctx.baseId}:<relationId>).`,
        path: relationPath.property('superTypes'),
        ref: relation.id,
      }),
    ];
  }

  private validateRelationSuperTypeQualified(
    ctx: ValidationContext,
    relation: GRelation,
    superType: Ref,
    relationPath: DiagnosticPath,
  ): Diagnostic[] {
    if (Reference.isQualified(superType)) return [];

    return [
      Diagnostics.error({
        code: VALIDATION_ERROR.RELATION_SUPERTYPE_NOT_QUALIFIED,
        message: `Relation '${relation.id}' superType must be qualified (${ctx.baseId}:<relationId>). Local supertypes are not allowed.`,
        path: relationPath.property('superTypes').index(0),
        ref: relation.id,
      }),
    ];
  }

  private validateRelationSuperTypeReferencesBase(
    ctx: ValidationContext,
    relation: GRelation,
    parts: QualifiedParts,
    relationPath: DiagnosticPath,
  ): Diagnostic[] {
    if (parts.modelId === ctx.baseId) return [];

    return [
      Diagnostics.error({
        code: VALIDATION_ERROR.RELATION_SUPERTYPE_NOT_BASE,
        message: `Relation '${relation.id}' superType must reference base model '${ctx.baseId}', but references '${parts.modelId}'.`,
        path: relationPath.property('superTypes').index(0),
        ref: relation.id,
      }),
    ];
  }

  private validateBaseRelationExists(
    baseRelationId: Id,
    baseRelation: GRelation | undefined,
    relationPath: DiagnosticPath,
  ): Diagnostic[] {
    if (baseRelation) return [];

    return [
      Diagnostics.error({
        code: VALIDATION_ERROR.BASE_RELATION_NOT_FOUND,
        message: `Base relation '${baseRelationId}' not found.`,
        path: relationPath.property('superTypes').index(0),
        ref: baseRelationId,
      }),
    ];
  }

  private validateComposite(
    derivedRelation: GRelation,
    baseRelation: GRelation,
    relationPath: DiagnosticPath,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const derivedFrom: boolean = derivedRelation.from.isComposite === true;
    const derivedTo: boolean = derivedRelation.to.isComposite === true;

    if (derivedFrom && derivedTo) {
      diagnostics.push(
        Diagnostics.error({
          code: VALIDATION_ERROR.RELATION_COMPOSITE_BOTH_ENDS,
          message: `Relation '${derivedRelation.id}' must not be composite on both ends.`,
          path: relationPath,
          ref: derivedRelation.id,
        }),
      );
    }

    const baseFrom: boolean = baseRelation.from.isComposite === true;
    const baseTo: boolean = baseRelation.to.isComposite === true;

    if (derivedFrom !== baseFrom) {
      diagnostics.push(
        Diagnostics.error({
          code: VALIDATION_ERROR.RELATION_COMPOSITE_MISMATCH,
          message: `from.isComposite must be '${baseFrom}'.`,
          path: relationPath.property('from').property('isComposite'),
          ref: derivedRelation.id,
        }),
      );
    }

    if (derivedTo !== baseTo) {
      diagnostics.push(
        Diagnostics.error({
          code: VALIDATION_ERROR.RELATION_COMPOSITE_MISMATCH,
          message: `to.isComposite must be '${baseTo}'.`,
          path: relationPath.property('to').property('isComposite'),
          ref: derivedRelation.id,
        }),
      );
    }

    return diagnostics;
  }
}
