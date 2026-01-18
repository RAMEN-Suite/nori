import { Bounds, GAttribute, GNode, TypeRef } from '../../models/GModel';
import {
  Diagnostic,
  DiagnosticPath,
  DiagnosticReport,
  Diagnostics,
} from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { Builtins } from '../container/References';
import { ValidationContext } from '../SemanticValidator';
import { BaseNode, SemanticValidationHelper } from '../helper/SemanticValidationHelper';

export class AttributeRules {
  public validate(
    validationContext: ValidationContext,
    node: GNode,
    classifierPath: DiagnosticPath,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const attributes: GAttribute[] = node.attributes ?? [];
    const inheritedAttributeNames: ReadonlySet<string> = this.getInheritedAttributeNames(
      validationContext,
      node,
    );

    const firstIndexByName: Map<string, number> = new Map<string, number>();

    attributes.forEach((attribute: GAttribute, attributeIndex: number): void => {
      const attributePath: DiagnosticPath = classifierPath
        .property('attributes')
        .index(attributeIndex);

      const previousIndex: number | undefined = firstIndexByName.get(attribute.name);
      if (previousIndex !== undefined) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.ATTRIBUTE_NAME_DUPLICATE,
          message: `Duplicate attribute name '${attribute.name}' in node '${node.id}' (also at index ${previousIndex}).`,
          path: attributePath.property('name'),
          ref: node.id,
        };
        diagnostics.push(Diagnostics.error(report));
      } else {
        firstIndexByName.set(attribute.name, attributeIndex);
      }

      if (inheritedAttributeNames.has(attribute.name)) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.ATTRIBUTE_NAME_SHADOWS_BASE,
          message: `Attribute '${attribute.name}' in node '${node.id}' conflicts with inherited base attribute.`,
          path: attributePath.property('name'),
          ref: node.id,
        };
        diagnostics.push(Diagnostics.error(report));
      }

      const bounds: Bounds = attribute.bounds;
      const boundsAreValid: boolean =
        bounds.lowerBound >= 0 &&
        (bounds.upperBound === -1 || bounds.upperBound >= bounds.lowerBound);

      if (!boundsAreValid) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.ATTRIBUTE_BOUNDS_INVALID,
          message: `Invalid bounds for attribute '${attribute.name}' in node '${node.id}'.`,
          path: attributePath.property('bounds'),
          ref: node.id,
        };
        diagnostics.push(Diagnostics.error(report));
      }

      const typeExists: boolean = this.attributeTypeExists(validationContext, attribute.typeId);
      if (!typeExists) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.ATTRIBUTE_TYPE_NOT_FOUND,
          message: `Attribute '${attribute.name}' in node '${node.id}' references unknown type '${attribute.typeId}'.`,
          path: attributePath.property('typeId'),
          ref: node.id,
        };
        diagnostics.push(Diagnostics.error(report));
      }
    });

    return diagnostics;
  }

  private getInheritedAttributeNames(
    validationContext: ValidationContext,
    node: GNode,
  ): ReadonlySet<string> {
    const baseNode: BaseNode | null = SemanticValidationHelper.getBaseSuperType(
      node,
      validationContext.baseId,
    );
    if (!baseNode) return new Set<string>();

    const baseNodeDefinition: GNode | undefined = validationContext.baseIndex.nodesById.get(
      baseNode.baseNodeId,
    );
    if (!baseNodeDefinition) return new Set<string>();

    const names: Set<string> = new Set<string>();
    const baseAttributes: GAttribute[] = baseNodeDefinition.attributes ?? [];
    baseAttributes.forEach((attribute: GAttribute): void => {
      names.add(attribute.name);
    });

    return names;
  }

  private attributeTypeExists(validationContext: ValidationContext, typeId: TypeRef): boolean {
    if (Builtins.isBuiltin(typeId)) return true;
    if (validationContext.derivedIndex.dataTypesById.has(typeId)) return true;

    const baseTypeId: string | null = SemanticValidationHelper.getBaseQualifiedId(
      typeId,
      validationContext.baseId,
    );
    if (!baseTypeId) return false;

    return validationContext.baseIndex.dataTypesById.has(baseTypeId);
  }
}
