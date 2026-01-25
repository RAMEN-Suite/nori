import { GAttribute, GNode, Id, TypeRef } from '../../models/GModel';
import { Diagnostic, DiagnosticPath, DiagnosticReport, Diagnostics } from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { QualifiedParts, Reference } from '../container/Reference';
import { ValidationContext } from '../SemanticValidator';
import { SemanticHelper } from '../../helper/SemanticHelper';
import { BaseNode, SemanticResolver } from '../../helper/SemanticResolver';
import { Builtins } from '../container/Builtins';
import { Rules } from '../../models/Rules';

export class AttributeRules implements Rules {
  public validate(validationContext: ValidationContext, node: GNode, classifierPath: DiagnosticPath): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const attributes: GAttribute[] = node.attributes ?? [];
    const inheritedAttributeNames: ReadonlySet<string> = this.getInheritedAttributeNames(validationContext, node);

    const firstIndexByName: Map<string, number> = new Map<string, number>();

    attributes.forEach((attribute: GAttribute, attributeIndex: number): void => {
      const attributePath: DiagnosticPath = classifierPath.property('attributes').index(attributeIndex);

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

      if (!SemanticHelper.areBoundsCoherent(attribute.bounds)) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.ATTRIBUTE_BOUNDS_INVALID,
          message: `Invalid bounds for attribute '${attribute.name}' in node '${node.id}'.`,
          path: attributePath.property('bounds'),
          ref: node.id,
        };
        diagnostics.push(Diagnostics.error(report));
      } else {
        diagnostics.push(...this.validateAttributeFlags(attribute, node, attributePath));
      }

      const isTypeExisting: boolean = this.attributeTypeExists(validationContext, attribute.typeId);
      if (!isTypeExisting) {
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

  private validateAttributeFlags(attribute: GAttribute, node: GNode, attributePath: DiagnosticPath): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const isKey: boolean = attribute.isKey === true;
    const isDerived: boolean = attribute.isDerived === true;
    const isReadOnly: boolean = attribute.isReadOnly === true;

    if (isKey) {
      const lowerBound: number = attribute.bounds.lowerBound;
      const upperBound: number = attribute.bounds.upperBound;

      const isSingleValued: boolean = upperBound === 1;
      const isRequired: boolean = lowerBound >= 1;

      if (!isSingleValued || !isRequired) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.ATTRIBUTE_KEY_BOUNDS_INVALID,
          message: `Key attribute '${attribute.name}' in node '${node.id}' should have bounds 1..1.`,
          path: attributePath.property('bounds'),
          ref: node.id,
        };
        diagnostics.push(Diagnostics.warn(report));
      }

      if (isDerived) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.ATTRIBUTE_KEY_DERIVED_INVALID,
          message: `Key attribute '${attribute.name}' in node '${node.id}' must not be derived.`,
          path: attributePath.property('isDerived'),
          ref: node.id,
        };
        diagnostics.push(Diagnostics.warn(report));
      }
    }

    if (isDerived && !isReadOnly) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.ATTRIBUTE_DERIVED_NOT_READONLY,
        message: `Derived attribute '${attribute.name}' in node '${node.id}' should be read-only.`,
        path: attributePath.property('isReadOnly'),
        ref: node.id,
      };
      diagnostics.push(Diagnostics.warn(report));
    }

    return diagnostics;
  }

  private getInheritedAttributeNames(validationContext: ValidationContext, node: GNode): ReadonlySet<string> {
    const names: Set<string> = new Set<string>();

    const startModel: Id = validationContext.derivedIndex.model.id;
    const startNode: Id = node.id;
    const { models } = validationContext;

    const chain: ReadonlyArray<BaseNode> = SemanticResolver.getBaseNodeChain(startModel, startNode, models);
    if (chain.length === 0) return names;

    for (const item of chain) {
      const attributes: ReadonlyArray<GAttribute> = item.node.attributes ?? [];
      for (const attribute of attributes) names.add(attribute.name);
    }

    return names;
  }

  private attributeTypeExists(validationContext: ValidationContext, typeRef: TypeRef): boolean {
    if (Builtins.isBuiltin(typeRef)) return true;
    const { baseId, baseIndex, derivedIndex } = validationContext;

    if (Reference.isQualified(typeRef)) {
      const baseNode: QualifiedParts | null = SemanticResolver.getQualifiedPartsFromRef(typeRef, baseId);
      return !!baseNode && baseIndex.dataTypesById.has(baseNode.nodeId);
    }

    return derivedIndex.dataTypesById.has(typeRef);
  }
}
