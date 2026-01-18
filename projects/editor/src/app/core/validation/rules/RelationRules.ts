import { GNode, GRelation, Id } from '../../models/GModel';
import {
  Diagnostic,
  DiagnosticPath,
  DiagnosticReport,
  Diagnostics,
} from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { ValidationContext } from '../SemanticValidator';
import { BaseNode, SemanticValidationHelper } from '../helper/SemanticValidationHelper';

export class RelationRules {
  public validate(validationContext: ValidationContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const relations: GRelation[] = validationContext.derivedModel.relations ?? [];

    diagnostics.push(...this.validateUniqueIdentifiers(relations));

    relations.forEach((relation: GRelation, relationIndex: number): void => {
      const relationPath: DiagnosticPath = DiagnosticPath.root()
        .property('relations')
        .index(relationIndex);

      const baseRelationId: Id | null = SemanticValidationHelper.getBaseRelationSuperTypeId(
        relation,
        validationContext.baseId,
      );

      if (!baseRelationId) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.RELATION_SUPERTYPE_INVALID,
          message: `Relation '${relation.id}' must have exactly one base superType (${validationContext.baseId}:<relationId>).`,
          path: relationPath.property('superTypes'),
          ref: relation.id,
        };
        diagnostics.push(Diagnostics.error(report));
        return;
      }

      const baseRelation: GRelation | undefined =
        validationContext.baseIndex.relationsById.get(baseRelationId);
      if (!baseRelation) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.BASE_RELATION_NOT_FOUND,
          message: `Base relation '${baseRelationId}' not found.`,
          path: relationPath.property('superTypes').index(0),
          ref: relation.id,
        };
        diagnostics.push(Diagnostics.error(report));
        return;
      }

      if (!SemanticValidationHelper.areRelationEndsLocal(relation)) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.RELATION_ENDS_NOT_LOCAL,
          message: `Relation ends must reference local nodes.`,
          path: relationPath,
          ref: relation.id,
        };
        diagnostics.push(Diagnostics.error(report));
        return;
      }

      diagnostics.push(...this.validateEndNodes(validationContext, relation, relationPath));
      diagnostics.push(
        ...this.validateEndCompatibility(validationContext, relation, baseRelation, relationPath),
      );
      diagnostics.push(...this.validateRolesMatch(relation, baseRelation, relationPath));
      diagnostics.push(...this.validateBoundsMatch(relation, baseRelation, relationPath));
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

  private validateEndNodes(
    validationContext: ValidationContext,
    relation: GRelation,
    relationPath: DiagnosticPath,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const fromNodeId: string = relation.from.nodeId;
    const toNodeId: string = relation.to.nodeId;

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

    const fromNode: GNode | undefined = validationContext.derivedIndex.nodesById.get(
      derivedRelation.from.nodeId,
    );
    const toNode: GNode | undefined = validationContext.derivedIndex.nodesById.get(
      derivedRelation.to.nodeId,
    );

    if (!fromNode || !toNode) return diagnostics;

    const fromBaseNode: BaseNode | null = SemanticValidationHelper.getBaseSuperType(
      fromNode,
      validationContext.baseId,
    );
    if (!fromBaseNode) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.FROM_NODE_SUPERTYPE_INVALID,
        message: `From-node '${fromNode.id}' must have exactly one base superType.`,
        path: relationPath.property('from').property('nodeId'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
      return diagnostics;
    }

    const toBaseNode: BaseNode | null = SemanticValidationHelper.getBaseSuperType(
      toNode,
      validationContext.baseId,
    );
    if (!toBaseNode) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.TO_NODE_SUPERTYPE_INVALID,
        message: `To-node '${toNode.id}' must have exactly one base superType.`,
        path: relationPath.property('to').property('nodeId'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
      return diagnostics;
    }

    if (fromBaseNode.baseNodeId !== baseRelation.from.nodeId) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_FROM_INCOMPATIBLE,
        message: `From-node '${fromNode.id}' must specialize base '${baseRelation.from.nodeId}'.`,
        path: relationPath.property('from').property('nodeId'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    if (toBaseNode.baseNodeId !== baseRelation.to.nodeId) {
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

    const fromRoleMatches: boolean = derivedRelation.from.role === baseRelation.from.role;
    const toRoleMatches: boolean = derivedRelation.to.role === baseRelation.to.role;

    if (!fromRoleMatches) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_ROLE_MISMATCH,
        message: `from.role must be '${baseRelation.from.role}'.`,
        path: relationPath.property('from').property('role'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    if (!toRoleMatches) {
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

    if (
      !SemanticValidationHelper.isDerivedBoundsCompatible(
        baseRelation.from.bounds,
        derivedRelation.from.bounds,
      )
    ) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_FROM_BOUNDS_INVALID,
        message: `from.bounds must specialize base bounds.`,
        path: relationPath.property('from').property('bounds'),
        ref: derivedRelation.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    if (
      !SemanticValidationHelper.isDerivedBoundsCompatible(
        baseRelation.to.bounds,
        derivedRelation.to.bounds,
      )
    ) {
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
