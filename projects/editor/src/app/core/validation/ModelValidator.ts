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

export class ModelValidator {
  private readonly strict: StrictDomainValidator = new StrictDomainValidator();

  public validate(base: unknown, derived: unknown, options: ValidateModelOptions): Diagnostic[] {
    const baseSchemaErrors: Diagnostic[] = this.validateSchema('BASE', base, options);
    if (baseSchemaErrors.length > 0) return baseSchemaErrors;

    const derivedSchemaErrors: Diagnostic[] = this.validateSchema('DERIVED', base, options);
    if (derivedSchemaErrors.length > 0) return derivedSchemaErrors;

    return this.strict.validate(base as GModel, derived as GModel, {
      baseAlias: options.baseAlias,
    });
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
