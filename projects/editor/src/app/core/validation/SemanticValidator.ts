import { GModel, Id } from '../models/GModel';
import { GModelIndex } from './container/GModelIndex';
import { Diagnostic } from './container/Diagnostics';
import { RelationRules } from './rules/RelationRules';
import { ClassifierRules } from './rules/ClassifierRules';
import { ImportRules } from './rules/ImportRules';
import { VALIDATION_ERROR } from '../const/VALIDATION_ERROR';

export interface ValidationOptions {
  readonly baseId: string;
}

export interface ValidationContext {
  readonly baseId: Id;
  readonly baseIndex: GModelIndex;
  readonly derivedIndex: GModelIndex;
  readonly baseModel: GModel;
  readonly derivedModel: GModel;
  readonly models: ReadonlyMap<Id, GModel>;
}

export class SemanticValidator {
  private readonly classifierRules: ClassifierRules = new ClassifierRules();
  private readonly relationRules: RelationRules = new RelationRules();
  private readonly importRules: ImportRules = new ImportRules();

  public validate(
    baseModel: GModel,
    derivedModel: GModel,
    models: ReadonlyMap<Id, GModel>,
    options: ValidationOptions,
  ): Diagnostic[] {
    const baseIndex: GModelIndex = new GModelIndex(baseModel);
    const derivedIndex: GModelIndex = new GModelIndex(derivedModel);

    const validationContext: ValidationContext = {
      baseId: options.baseId,
      baseIndex: baseIndex,
      derivedIndex: derivedIndex,
      baseModel: baseModel,
      derivedModel: derivedModel,
      models: models,
    };

    const diagnostics: Diagnostic[] = [];
    diagnostics.push(...this.importRules.validate(validationContext));

    if (diagnostics.some((d: Diagnostic): boolean => d.code === VALIDATION_ERROR.MISSING_BASE_IMPORT)) {
      return diagnostics;
    }

    diagnostics.push(...this.classifierRules.validate(validationContext));
    diagnostics.push(...this.relationRules.validate(validationContext));
    return diagnostics;
  }
}
