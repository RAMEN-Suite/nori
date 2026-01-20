import { GModel, Id } from '../models/GModel';
import { GModelIndex } from './container/GModelIndex';
import { Diagnostic, DiagnosticPath, DiagnosticReport, Diagnostics } from './container/Diagnostics';
import { VALIDATION_ERROR } from '../const/VALIDATION_ERROR';
import { RelationRules } from './rules/RelationRules';
import { ClassifierRules } from './rules/ClassifierRules';

export interface ValidationOptions {
  readonly baseId: string;
}

export interface ValidationContext {
  readonly baseModel: GModel;
  readonly derivedModel: GModel;
  readonly baseIndex: GModelIndex;
  readonly derivedIndex: GModelIndex;
  readonly baseId: Id;
}

export class SemanticValidator {
  private readonly classifierRules: ClassifierRules = new ClassifierRules();
  private readonly relationRules: RelationRules = new RelationRules();

  public validate(base: GModel, derived: GModel, options: ValidationOptions): Diagnostic[] {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const derivedIndex: GModelIndex = new GModelIndex(derived);

    if (!derivedIndex.importsByModelId.has(options.baseId)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.MISSING_BASE_IMPORT,
        message: `Derived model must import base with modelId '${options.baseId}'.`,
        ref: options.baseId,
        path: DiagnosticPath.root().property('imports'),
      };
      return [Diagnostics.error(report)];
    }

    const validationContext: ValidationContext = {
      baseModel: base,
      derivedModel: derived,
      baseIndex,
      derivedIndex,
      baseId: options.baseId,
    };

    const diagnostics: Diagnostic[] = [];
    diagnostics.push(...this.classifierRules.validate(validationContext));
    diagnostics.push(...this.relationRules.validate(validationContext));
    return diagnostics;
  }
}
