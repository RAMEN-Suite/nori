import { GNode } from '../../models/GModel';
import { Diagnostic, DiagnosticPath, DiagnosticReport, Diagnostics } from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { ValidationContext } from '../SemanticValidator';
import { BaseNode, SemanticHelper } from '../../helper/SemanticHelper';

export class NodeRules {
  public validate(validationContext: ValidationContext, node: GNode, classifierPath: DiagnosticPath): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const baseNode: BaseNode | null = SemanticHelper.getBaseSuperType(node, validationContext.baseId);
    if (!baseNode) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.NODE_SUPERTYPE_INVALID,
        message: `Node '${node.id}' must have exactly one base superType (${validationContext.baseId}:<nodeId>).`,
        path: classifierPath.property('superTypes').index(0),
        ref: node.id,
      };
      diagnostics.push(Diagnostics.error(report));
      return diagnostics;
    }

    if (!validationContext.baseIndex.nodesById.has(baseNode.baseNodeId)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.BASE_NODE_NOT_FOUND,
        message: `Base node '${baseNode.baseNodeId}' not found.`,
        path: classifierPath.property('superTypes').index(0),
        ref: baseNode.baseNodeId,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    return diagnostics;
  }
}
