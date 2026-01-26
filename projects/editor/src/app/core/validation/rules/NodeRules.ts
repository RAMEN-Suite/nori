import { GNode, Id, Ref } from '../../models/GModel';
import { Diagnostic, DiagnosticPath, DiagnosticReport, Diagnostics } from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { ValidationContext } from '../SemanticValidator';
import { QualifiedParts, Reference } from '../container/Reference';
import { AbstractRule } from './AbstractRule';

export class NodeRules extends AbstractRule {
  public validate(validationContext: ValidationContext, node: GNode, classifierPath: DiagnosticPath): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const superTypes: ReadonlyArray<Ref> = node.superTypes ?? [];
    if (superTypes.length !== 1) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.NODE_SUPERTYPE_CARDINALITY_INVALID,
        message: `Node '${node.id}' must declare exactly one base superType (${validationContext.baseId}:<nodeId>).`,
        path: classifierPath.property('superTypes'),
        ref: node.id,
      };
      diagnostics.push(Diagnostics.error(report));
      return diagnostics;
    }

    const superType: Ref = superTypes[0]!;
    if (!Reference.isQualified(superType)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.NODE_SUPERTYPE_NOT_QUALIFIED,
        message: `Node '${node.id}' superType must be qualified (${validationContext.baseId}:<nodeId>). Local supertypes are not allowed.`,
        path: classifierPath.property('superTypes').index(0),
        ref: node.id,
      };
      diagnostics.push(Diagnostics.error(report));
      return diagnostics;
    }

    const parts: QualifiedParts = Reference.splitQualified(superType);
    if (parts.modelId !== validationContext.baseId) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.NODE_SUPERTYPE_NOT_BASE,
        message: `Node '${node.id}' superType must reference base model '${validationContext.baseId}', but references '${parts.modelId}'.`,
        path: classifierPath.property('superTypes').index(0),
        ref: node.id,
      };
      diagnostics.push(Diagnostics.error(report));
      return diagnostics;
    }

    const baseNodeId: Id = parts.refId;
    if (!validationContext.baseIndex.nodesById.has(baseNodeId)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.BASE_NODE_NOT_FOUND,
        message: `Base node '${baseNodeId}' not found.`,
        path: classifierPath.property('superTypes').index(0),
        ref: baseNodeId,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    return diagnostics;
  }
}
