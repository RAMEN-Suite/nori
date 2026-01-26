import { GNode, GRelation, Id, Ref } from '../../models/GModel';
import { Diagnostic, DiagnosticPath, DiagnosticReport, Diagnostics } from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { ValidationContext } from '../SemanticValidator';
import { SemanticHelper } from '../../helper/SemanticHelper';
import { QualifiedParts, Reference } from '../container/Reference';
import { NodeResolver } from '../../resolver/NodeResolver';
import { AbstractRule } from './AbstractRule';

type SuperTypeValidationResult = {
  readonly baseRelationId: Id | null;
  readonly diagnostics: Diagnostic[];
};

export class RelationRules extends AbstractRule {
  public validate(validationContext: ValidationContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const relations: GRelation[] = validationContext.derivedModel.relations ?? [];

    diagnostics.push(...this.validateUniqueIdentifiers(relations));

    relations.forEach((relation: GRelation, relationIndex: number): void => {
      const path: DiagnosticPath = DiagnosticPath.root().property('relations').index(relationIndex);
      diagnostics.push(...this.validateRelationEndBoundsCoherence(relation, path));

      const result: SuperTypeValidationResult = this.validateRelationSuperType(validationContext, relation, path);
      diagnostics.push(...result.diagnostics);
      if (!result.baseRelationId) return;

      const baseRelation: GRelation | undefined = validationContext.baseIndex.relationsById.get(result.baseRelationId);
      if (!baseRelation) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.BASE_RELATION_NOT_FOUND,
          message: `Base relation '${result.baseRelationId}' not found.`,
          path: path.property('superTypes').index(0),
          ref: result.baseRelationId,
        };
        diagnostics.push(Diagnostics.error(report));
        return;
      }

      diagnostics.push(...this.validateComposite(relation, baseRelation, path));

      if (!SemanticHelper.areRelationEndsLocal(relation)) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.RELATION_ENDS_NOT_LOCAL,
          message: `Relation ends must reference local nodes.`,
          path: path.property('from').property('nodeId'),
          ref: relation.id,
        };
        diagnostics.push(Diagnostics.error(report));
        return;
      }

      const eDiags: Diagnostic[] = this.validateEndNodes(validationContext, relation, path);
      diagnostics.push(...eDiags);
      if (eDiags.length > 0) return;

      diagnostics.push(...this.validateEndCompatibility(validationContext, relation, baseRelation, path));
      diagnostics.push(...this.validateRolesMatch(relation, baseRelation, path));
      diagnostics.push(...this.validateBoundsMatch(relation, baseRelation, path));
    });

    return diagnostics;
  }

  private validateUniqueIdentifiers(relations: GRelation[]): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const firstIndexByIdentifier: Map<Id, number> = new Map<Id, number>();

    relations.forEach((relation: GRelation, relationIndex: number): void => {
      const relationIdentifier: Id = relation.id;
      const previousIndex: number | undefined = firstIndexByIdentifier.get(relationIdentifier);

      if (previousIndex !== undefined) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.RELATION_ID_DUPLICATE,
          message: `Duplicate relation id '${relationIdentifier}' (also at index ${previousIndex}).`,
          path: DiagnosticPath.root().property('relations').index(relationIndex).property('id'),
          ref: relationIdentifier,
        };
        diagnostics.push(Diagnostics.error(report));
        return;
      }

      firstIndexByIdentifier.set(relationIdentifier, relationIndex);
    });

    return diagnostics;
  }

  private validateRelationEndBoundsCoherence(relation: GRelation, relationPath: DiagnosticPath): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (!SemanticHelper.areBoundsCoherent(relation.from.bounds)) {
      diagnostics.push(
        Diagnostics.error({
          code: VALIDATION_ERROR.RELATION_FROM_BOUNDS_COHERENCE_INVALID,
          message: `Invalid bounds for relation '${relation.id}' (from.bounds).`,
          path: relationPath.property('from').property('bounds'),
          ref: relation.id,
        }),
      );
    }

    if (!SemanticHelper.areBoundsCoherent(relation.to.bounds)) {
      diagnostics.push(
        Diagnostics.error({
          code: VALIDATION_ERROR.RELATION_TO_BOUNDS_COHERENCE_INVALID,
          message: `Invalid bounds for relation '${relation.id}' (to.bounds).`,
          path: relationPath.property('to').property('bounds'),
          ref: relation.id,
        }),
      );
    }

    return diagnostics;
  }

  private validateRelationSuperType(
    validationContext: ValidationContext,
    relation: GRelation,
    relationPath: DiagnosticPath,
  ): SuperTypeValidationResult {
    const diagnostics: Diagnostic[] = [];
    const superTypes: ReadonlyArray<Ref> = relation.superTypes ?? [];

    if (superTypes.length !== 1) {
      diagnostics.push(
        Diagnostics.error({
          code: VALIDATION_ERROR.RELATION_SUPERTYPE_CARDINALITY_INVALID,
          message: `Relation '${relation.id}' must declare exactly one base superType (${validationContext.baseId}:<relationId>).`,
          path: relationPath.property('superTypes'),
          ref: relation.id,
        }),
      );
      return { baseRelationId: null, diagnostics };
    }

    const superType: Ref = superTypes[0]!;
    if (!Reference.isQualified(superType)) {
      diagnostics.push(
        Diagnostics.error({
          code: VALIDATION_ERROR.RELATION_SUPERTYPE_NOT_QUALIFIED,
          message: `Relation '${relation.id}' superType must be qualified (${validationContext.baseId}:<relationId>). Local supertypes are not allowed.`,
          path: relationPath.property('superTypes').index(0),
          ref: relation.id,
        }),
      );
      return { baseRelationId: null, diagnostics };
    }

    const parts: QualifiedParts = Reference.splitQualified(superType);
    if (parts.modelId !== validationContext.baseId) {
      diagnostics.push(
        Diagnostics.error({
          code: VALIDATION_ERROR.RELATION_SUPERTYPE_NOT_BASE,
          message: `Relation '${relation.id}' superType must reference base model '${validationContext.baseId}', but references '${parts.modelId}'.`,
          path: relationPath.property('superTypes').index(0),
          ref: relation.id,
        }),
      );
      return { baseRelationId: null, diagnostics };
    }

    return { baseRelationId: parts.refId, diagnostics };
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

  private validateEndNodes(
    validationContext: ValidationContext,
    relation: GRelation,
    relationPath: DiagnosticPath,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const fromNodeId: Id = relation.from.nodeId;
    const toNodeId: Id = relation.to.nodeId;

    const fromNode: GNode | undefined = validationContext.derivedIndex.nodesById.get(fromNodeId);
    if (!fromNode) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_FROM_NODE_NOT_FOUND,
        message: `From-node '${fromNodeId}' not found in derived model.`,
        path: relationPath.property('from').property('nodeId'),
        ref: relation.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    const toNode: GNode | undefined = validationContext.derivedIndex.nodesById.get(toNodeId);
    if (!toNode) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_TO_NODE_NOT_FOUND,
        message: `To-node '${toNodeId}' not found in derived model.`,
        path: relationPath.property('to').property('nodeId'),
        ref: relation.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    return diagnostics;
  }

  private validateEndCompatibility(
    validationContext: ValidationContext,
    derivedRelation: GRelation,
    baseRelation: GRelation,
    relationPath: DiagnosticPath,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const fromNode: GNode | undefined = validationContext.derivedIndex.nodesById.get(derivedRelation.from.nodeId);
    const toNode: GNode | undefined = validationContext.derivedIndex.nodesById.get(derivedRelation.to.nodeId);

    if (!fromNode || !toNode) return diagnostics;

    const fromParts: QualifiedParts | null = NodeResolver.resolveLocalSuperType(
      fromNode.superTypes,
      validationContext.baseId,
    );
    if (!fromParts) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.FROM_NODE_SUPERTYPE_INVALID,
        message: `From-node '${fromNode.id}' must have exactly one base superType.`,
        path: relationPath.property('from').property('nodeId'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
      return diagnostics;
    }

    const toParts: QualifiedParts | null = NodeResolver.resolveLocalSuperType(
      toNode.superTypes,
      validationContext.baseId,
    );
    if (!toParts) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.TO_NODE_SUPERTYPE_INVALID,
        message: `To-node '${toNode.id}' must have exactly one base superType.`,
        path: relationPath.property('to').property('nodeId'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
      return diagnostics;
    }

    if (fromParts.refId !== baseRelation.from.nodeId) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_FROM_INCOMPATIBLE,
        message: `From-node '${fromNode.id}' must specialize base '${baseRelation.from.nodeId}'.`,
        path: relationPath.property('from').property('nodeId'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    if (toParts.refId !== baseRelation.to.nodeId) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_TO_INCOMPATIBLE,
        message: `To-node '${toNode.id}' must specialize base '${baseRelation.to.nodeId}'.`,
        path: relationPath.property('to').property('nodeId'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    return diagnostics;
  }

  private validateRolesMatch(
    derivedRelation: GRelation,
    baseRelation: GRelation,
    relationPath: DiagnosticPath,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const isFromRoleMatching: boolean = derivedRelation.from.role === baseRelation.from.role;
    const isToRoleMatching: boolean = derivedRelation.to.role === baseRelation.to.role;

    if (!isFromRoleMatching) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_ROLE_MISMATCH,
        message: `from.role must be '${baseRelation.from.role}'.`,
        path: relationPath.property('from').property('role'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    if (!isToRoleMatching) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_ROLE_MISMATCH,
        message: `to.role must be '${baseRelation.to.role}'.`,
        path: relationPath.property('to').property('role'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    return diagnostics;
  }

  private validateBoundsMatch(
    derivedRelation: GRelation,
    baseRelation: GRelation,
    relationPath: DiagnosticPath,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (!SemanticHelper.isModelBoundsCompatible(baseRelation.from.bounds, derivedRelation.from.bounds)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_FROM_BOUNDS_INVALID,
        message: `from.bounds must specialize base bounds.`,
        path: relationPath.property('from').property('bounds'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    if (!SemanticHelper.isModelBoundsCompatible(baseRelation.to.bounds, derivedRelation.to.bounds)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_TO_BOUNDS_INVALID,
        message: `to.bounds must specialize base bounds.`,
        path: relationPath.property('to').property('bounds'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    return diagnostics;
  }
}
