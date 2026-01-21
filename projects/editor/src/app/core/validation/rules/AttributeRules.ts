import { GAttribute, GNode, Id, TypeRef } from '../../models/GModel';
import { Diagnostic, DiagnosticPath, DiagnosticReport, Diagnostics } from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { Builtins, Refs } from '../container/References';
import { ValidationContext } from '../SemanticValidator';
import { SemanticHelper, SuperTypeChainItem } from '../../helper/SemanticHelper';

export class AttributeRules {
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

  private getInheritedAttributeNames(validationContext: ValidationContext, node: GNode): ReadonlySet<string> {
    const names: Set<string> = new Set<string>();

    const startModel: Id = validationContext.derivedIndex.model.id;
    const startNode: Id = node.id;
    const { models } = validationContext;

    const chain: ReadonlyArray<SuperTypeChainItem> = SemanticHelper.getSuperTypeChain(startModel, startNode, models);
    if (chain.length === 0) return names;

    for (const item of chain) {
      const attributes: ReadonlyArray<GAttribute> = item.node.attributes ?? [];
      for (const attribute of attributes) names.add(attribute.name);
    }

    return names;
  }

  private attributeTypeExists(validationContext: ValidationContext, typeId: TypeRef): boolean {
    if (Builtins.isBuiltin(typeId)) return true;
    const { baseId, baseIndex, derivedIndex } = validationContext;

    if (Refs.isQualified(typeId)) {
      const baseTypeId: Id | null = SemanticHelper.getBaseQualifiedId(typeId, baseId);
      return !!baseTypeId && baseIndex.dataTypesById.has(baseTypeId);
    }

    return derivedIndex.dataTypesById.has(typeId);
  }
}
