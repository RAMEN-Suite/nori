import { GDataType } from '../../../models/GModel';
import {
  Diagnostic,
  DiagnosticPath,
  DiagnosticReport,
  Diagnostics,
} from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { Builtins, Refs } from '../container/References';
import { ValidationContext } from '../SemanticValidator';

export class DataTypeRules {
  public validate(
    validationContext: ValidationContext,
    dataType: GDataType,
    classifierPath: DiagnosticPath,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (Builtins.isBuiltin(dataType.id)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.DATATYPE_ID_RESERVED,
        message: `DataType id '${dataType.id}' is reserved (builtin scalar).`,
        path: classifierPath.property('id'),
        ref: dataType.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    if (Refs.isQualified(dataType.id)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.DATATYPE_ID_NOT_LOCAL,
        message: `DataType id '${dataType.id}' must be local (unqualified).`,
        path: classifierPath.property('id'),
        ref: dataType.id,
      };
      diagnostics.push(Diagnostics.error(report));
    }

    return diagnostics;
  }
}
