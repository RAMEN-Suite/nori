import SemanticValidator, { ValidationOptions } from './SemanticValidator';
import { Diagnostic, DiagnosticPath, DiagnosticReport, Diagnostics } from './container/Diagnostics';
import { SchemaValidator } from './SchemaValidator';
import { VALIDATION_ERROR } from '../const/VALIDATION_ERROR';
import { GModel } from '../../models/GModel';

export type SchemaKind = 'BASE' | 'DERIVED';

export interface ValidationResult {
  readonly diagnostics: Diagnostic[];
  readonly hasErrors: boolean;
}

export class ModelValidator {
  private readonly strict: SemanticValidator = new SemanticValidator();

  public validate(base: unknown, derived: unknown): ValidationResult {
    const diagnostics: Diagnostic[] = [];

    this.validateSchema('BASE', base, diagnostics);
    this.validateSchema('DERIVED', derived, diagnostics);
    if (diagnostics.length > 0) return { diagnostics, hasErrors: true };

    const options: ValidationOptions = { baseId: base.id };
    const strict: Diagnostic[] = this.strict.validate(base, derived, options);

    const all: Diagnostic[] = [...diagnostics, ...strict];
    const hasErrors: boolean = all.some((d: Diagnostic): boolean => d.severity === 'error');
    return { diagnostics: all, hasErrors };
  }

  private validateSchema(
    kind: SchemaKind,
    input: unknown,
    diags: Diagnostic[],
  ): asserts input is GModel {
    try {
      SchemaValidator.assertValid(input);
    } catch (error: any) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.SCHEMA_INVALID,
        message: `${kind} - ${error.message}`,
        path: DiagnosticPath.root(),
      };
      diags.push(Diagnostics.error(report));
    }
  }
}
