import { GModel, Id, Import } from '../../models/GModel';
import { Diagnostic, DiagnosticPath, DiagnosticReport, Diagnostics } from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { ValidationContext } from '../SemanticValidator';
import { Rules } from '../../models/Rules';

export class ImportRules implements Rules {
  public validate(validationContext: ValidationContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const model: GModel = validationContext.derivedModel;

    const imports: Import[] = model.imports ?? [];
    const firstIndexByModelId: Map<Id, number> = new Map<Id, number>();

    imports.forEach((imp: Import, index: number): void => {
      const importPath: DiagnosticPath = DiagnosticPath.root().property('imports').index(index);

      const previous: number | undefined = firstIndexByModelId.get(imp.modelId);
      if (previous !== undefined) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.IMPORT_MODEL_ID_DUPLICATE,
          message: `Duplicate import modelId '${imp.modelId}' (also at index ${previous}).`,
          path: importPath.property('modelId'),
          ref: imp.modelId,
        };
        diagnostics.push(Diagnostics.error(report));
      } else {
        firstIndexByModelId.set(imp.modelId, index);
      }

      if (imp.modelId === model.id) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.IMPORT_SELF_NOT_ALLOWED,
          message: `Model '${model.id}' must not import itself.`,
          path: importPath.property('modelId'),
          ref: model.id,
        };
        diagnostics.push(Diagnostics.error(report));
      }
    });

    if (!validationContext.derivedIndex.importsByModelId.has(validationContext.baseId)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.MISSING_BASE_IMPORT,
        message: `Derived model must import base with modelId '${validationContext.baseId}'.`,
        ref: validationContext.baseId,
        path: DiagnosticPath.root().property('imports'),
      };
      diagnostics.push(Diagnostics.error(report));
    }

    return diagnostics;
  }
}
