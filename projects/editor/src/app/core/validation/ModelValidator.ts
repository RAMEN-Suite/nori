import { StrictDomainValidator } from './StrictDomainValidator';
import { Diagnostic, DiagnosticPath, DiagnosticReport, Diagnostics } from './container/Diagnostics';
import { SchemaValidator } from './SchemaValidator';
import { VALIDATION_ERROR } from '../const/VALIDATION_ERROR';
import { GModel } from '../../models/GModel';

export type SchemaKind = 'BASE' | 'DERIVED';

export interface ValidateModelOptions {
  readonly baseAlias: string;
  readonly throwOnSchemaError: boolean;
}

export interface ValidationResult {
  readonly diagnostics: Diagnostic[];
  readonly hasErrors: boolean;
}

export class ModelValidator {
  private readonly strict: StrictDomainValidator = new StrictDomainValidator();

  public validate(
    base: unknown,
    derived: unknown,
    options: ValidateModelOptions,
  ): ValidationResult {
    const diagnostics: Diagnostic[] = [];

    diagnostics.push(...this.validateSchema('BASE', base, options));
    diagnostics.push(...this.validateSchema('DERIVED', derived, options));
    if (diagnostics.length > 0) return { diagnostics, hasErrors: true };

    const strict: Diagnostic[] = this.strict.validate(base as GModel, derived as GModel, {
      baseAlias: options.baseAlias,
    });

    const all: Diagnostic[] = [...diagnostics, ...strict];
    const hasErrors: boolean = all.some((d: Diagnostic): boolean => d.severity === 'error');
    return { diagnostics: all, hasErrors };
  }

  private validateSchema(
    kind: SchemaKind,
    input: unknown,
    options: ValidateModelOptions,
  ): Diagnostic[] {
    try {
      if (options.throwOnSchemaError) {
        SchemaValidator.assertValid(input);
        return [];
      }

      if (SchemaValidator.isValid(input)) return [];

      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.SCHEMA_INVALID,
        message: `${kind} model does not conform to GCore schema.`,
        path: DiagnosticPath.root(),
      };

      return [Diagnostics.error(report)];
    } catch (error: unknown) {
      if (options.throwOnSchemaError) throw error;

      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.SCHEMA_INVALID,
        message: `${kind} model does not conform to GCore schema.`,
        path: DiagnosticPath.root(),
      };

      return [Diagnostics.error(report)];
    }
  }
}
