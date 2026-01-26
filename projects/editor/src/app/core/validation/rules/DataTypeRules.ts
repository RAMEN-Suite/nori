import { GDataType, GLiteral } from '../../models/GModel';
import { Diagnostic, DiagnosticPath, DiagnosticReport, Diagnostics } from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { AbstractRule } from './AbstractRule';

export class DataTypeRules extends AbstractRule {
  public validate(dataType: GDataType, classifierPath: DiagnosticPath): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const literals: GLiteral[] | undefined = dataType.literals;
    if (!literals) return diagnostics;

    if (literals.length === 0) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.DATATYPE_LITERALS_EMPTY,
        message: `Datatype '${dataType.id}' declares literals but contains none.`,
        path: classifierPath.property('literals'),
        ref: dataType.id,
      };
      diagnostics.push(Diagnostics.warn(report));
      return diagnostics;
    }

    diagnostics.push(
      ...this.validateUniqueLiteralNames(literals, classifierPath),
      ...this.validateUniqueLiteralSerializedForms(literals, classifierPath),
      ...this.validateUniqueLiteralValues(literals, classifierPath),
      ...this.validateLiteralValueConsistency(literals, classifierPath),
    );

    return diagnostics;
  }

  private validateUniqueLiteralNames(literals: GLiteral[], classifierPath: DiagnosticPath): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const firstIndexByName: Map<string, number> = new Map();

    literals.forEach((literal: GLiteral, index: number): void => {
      const previous: number | undefined = firstIndexByName.get(literal.name);

      if (previous !== undefined) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.DATATYPE_LITERAL_NAME_DUPLICATE,
          message: `Duplicate literal name '${literal.name}' (also at index ${previous}).`,
          path: classifierPath.property('literals').index(index).property('name'),
          ref: literal.name,
        };
        diagnostics.push(Diagnostics.error(report));
      } else {
        firstIndexByName.set(literal.name, index);
      }
    });

    return diagnostics;
  }

  private validateUniqueLiteralSerializedForms(literals: GLiteral[], classifierPath: DiagnosticPath): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const firstIndexBySerialized: Map<string, number> = new Map();

    literals.forEach((lit: GLiteral, index: number) => {
      const hasLiteral: boolean = !!lit.literal && lit.literal.trim().length > 0;
      const serialized: string = hasLiteral ? lit.literal! : lit.name;

      const previous: number | undefined = firstIndexBySerialized.get(serialized);
      if (previous !== undefined) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.DATATYPE_LITERAL_SERIALIZED_DUPLICATE,
          message: `Duplicate literal serialized form '${serialized}' (also at index ${previous}).`,
          path: classifierPath
            .property('literals')
            .index(index)
            .property(hasLiteral ? 'literal' : 'name'),
          ref: serialized,
        };
        diagnostics.push(Diagnostics.error(report));
      } else {
        firstIndexBySerialized.set(serialized, index);
      }
    });

    return diagnostics;
  }

  private validateUniqueLiteralValues(literals: GLiteral[], classifierPath: DiagnosticPath): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const firstIndexByValue: Map<number, number> = new Map();

    literals.forEach((literal: GLiteral, index: number): void => {
      if (literal.value === undefined || literal.value === null) return;

      const previous: number | undefined = firstIndexByValue.get(literal.value);
      if (previous !== undefined) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.DATATYPE_LITERAL_VALUE_DUPLICATE,
          message: `Duplicate literal value ${literal.value} (also at index ${previous}).`,
          path: classifierPath.property('literals').index(index).property('value'),
          ref: String(literal.value),
        };
        diagnostics.push(Diagnostics.error(report));
      } else {
        firstIndexByValue.set(literal.value, index);
      }
    });

    return diagnostics;
  }

  private validateLiteralValueConsistency(literals: GLiteral[], classifierPath: DiagnosticPath): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    let withValue: number = 0;
    let withoutValue: number = 0;

    for (const literal of literals) {
      if (literal.value === undefined || literal.value === null) withoutValue += 1;
      else withValue += 1;
    }

    if (withValue > 0 && withoutValue > 0) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.DATATYPE_LITERAL_VALUE_INCONSISTENT,
        message: `Datatype literals mix explicit 'value' assignments (${withValue}) and implicit values (${withoutValue}). Consider making values consistent.`,
        path: classifierPath.property('literals'),
        ref: String(withValue),
      };
      diagnostics.push(Diagnostics.warn(report));
    }

    return diagnostics;
  }
}
