import { GClassifier } from '../../../models/GModel';
import {
  Diagnostic,
  DiagnosticPath,
  DiagnosticReport,
  Diagnostics,
} from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { ValidationContext } from '../SemanticValidator';
import { NodeRules } from './NodeRules';
import { DataTypeRules } from './DataTypeRules';
import { AttributeRules } from './AttributeRules';

class ClassifierRules {
  private readonly nodeRules: NodeRules = new NodeRules();
  private readonly dataTypeRules: DataTypeRules = new DataTypeRules();
  private readonly attributeRules: AttributeRules = new AttributeRules();

  public validate(validationContext: ValidationContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const classifiers: GClassifier[] = validationContext.derivedModel.classifiers ?? [];

    diagnostics.push(...this.validateUniqueIdentifiers(classifiers));

    classifiers.forEach((classifier: GClassifier, classifierIndex: number): void => {
      const classifierPath: DiagnosticPath = DiagnosticPath.root()
        .property('classifiers')
        .index(classifierIndex);

      if (classifier.kind === 'GNode') {
        const nodeValidation: Diagnostic[] = this.nodeRules.validate(
          validationContext,
          classifier,
          classifierPath,
        );
        const attributeValidation: Diagnostic[] = this.attributeRules.validate(
          validationContext,
          classifier,
          classifierPath,
        );
        diagnostics.push(...nodeValidation, ...attributeValidation);
        return;
      }

      if (classifier.kind === 'GDataType') {
        const dataTypeValidation: Diagnostic[] = this.dataTypeRules.validate(
          validationContext,
          classifier,
          classifierPath,
        );
        diagnostics.push(...dataTypeValidation);
        return;
      }
    });

    return diagnostics;
  }

  private validateUniqueIdentifiers(classifiers: GClassifier[]): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const firstIndexByIdentifier: Map<string, number> = new Map<string, number>();

    classifiers.forEach((classifier: GClassifier, classifierIndex: number): void => {
      const classifierIdentifier: string = classifier.id;
      const previousIndex: number | undefined = firstIndexByIdentifier.get(classifierIdentifier);

      if (previousIndex !== undefined) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.CLASSIFIER_ID_DUPLICATE,
          message: `Duplicate classifier id '${classifierIdentifier}' (also at index ${previousIndex}).`,
          path: DiagnosticPath.root().property('classifiers').index(classifierIndex).property('id'),
          ref: classifierIdentifier,
        };
        diagnostics.push(Diagnostics.error(report));
        return;
      }

      firstIndexByIdentifier.set(classifierIdentifier, classifierIndex);
    });

    return diagnostics;
  }
}

export default ClassifierRules;
