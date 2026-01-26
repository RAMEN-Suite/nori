import { GAttribute, GModel, GNode, Id, TypeRef } from '../../models/GModel';
import { Diagnostic, DiagnosticPath, Diagnostics } from '../container/Diagnostics';
import { VALIDATION_ERROR } from '../../const/VALIDATION_ERROR';
import { ValidationContext } from '../SemanticValidator';
import { SemanticHelper } from '../../helper/SemanticHelper';
import { AbstractRules } from './AbstractRules';
import { Builtins } from '../container/Builtins';
import { QualifiedParts, Reference } from '../container/Reference';
import { ModelResolver } from '../../resolver/ModelResolver';
import { GModelIndex } from '../container/GModelIndex';
import { NodeResolver, ResolvedNode } from '../../resolver/NodeResolver';

export class AttributeRules extends AbstractRules {
  public validate(ctx: ValidationContext, node: GNode, classifierPath: DiagnosticPath): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const attributes: ReadonlyArray<GAttribute> = node.attributes ?? [];
    const inheritedNames: ReadonlySet<string> = this.resolveInheritedAttributeNames(ctx, node.id);

    diagnostics.push(...this.validateAttributeNames(attributes, node, classifierPath));
    diagnostics.push(...this.validateAttributes(ctx, node, attributes, inheritedNames, classifierPath));
    return diagnostics;
  }

  private validateAttributeNames(
    attributes: ReadonlyArray<GAttribute>,
    node: GNode,
    classifierPath: DiagnosticPath,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const firstIndexByName: Map<string, number> = new Map<string, number>();

    attributes.forEach((attribute: GAttribute, attributeIndex: number): void => {
      const previousIndex: number | undefined = firstIndexByName.get(attribute.name);
      if (previousIndex === undefined) {
        firstIndexByName.set(attribute.name, attributeIndex);
        return;
      }

      diagnostics.push(
        Diagnostics.error({
          code: VALIDATION_ERROR.ATTRIBUTE_NAME_DUPLICATE,
          message: `Duplicate attribute name '${attribute.name}' in node '${node.id}' (also at index ${previousIndex}).`,
          path: classifierPath.property('attributes').index(attributeIndex).property('name'),
          ref: node.id,
        }),
      );
    });

    return diagnostics;
  }

  private validateAttributes(
    validationContext: ValidationContext,
    node: GNode,
    attributes: ReadonlyArray<GAttribute>,
    inheritedNames: ReadonlySet<string>,
    classifierPath: DiagnosticPath,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    attributes.forEach((attribute: GAttribute, attributeIndex: number): void => {
      const attributePath: DiagnosticPath = classifierPath.property('attributes').index(attributeIndex);

      diagnostics.push(...this.validateNoInheritedShadowing(attribute, node, inheritedNames, attributePath));
      diagnostics.push(...this.validateBounds(attribute, node, attributePath));
      diagnostics.push(...this.validateKeyFlag(attribute, node, attributePath));
      diagnostics.push(...this.validateTypeResolvable(validationContext, attribute, node, attributePath));
    });

    return diagnostics;
  }

  private validateNoInheritedShadowing(
    attribute: GAttribute,
    node: GNode,
    inheritedNames: ReadonlySet<string>,
    attributePath: DiagnosticPath,
  ): Diagnostic[] {
    if (!inheritedNames.has(attribute.name)) return [];

    return [
      Diagnostics.error({
        code: VALIDATION_ERROR.ATTRIBUTE_NAME_SHADOWS_BASE,
        message: `Attribute '${attribute.name}' in node '${node.id}' conflicts with inherited base attribute.`,
        path: attributePath.property('name'),
        ref: node.id,
      }),
    ];
  }

  private validateBounds(attribute: GAttribute, node: GNode, attributePath: DiagnosticPath): Diagnostic[] {
    if (SemanticHelper.areBoundsCoherent(attribute.bounds)) return [];

    return [
      Diagnostics.error({
        code: VALIDATION_ERROR.ATTRIBUTE_BOUNDS_INVALID,
        message: `Invalid bounds for attribute '${attribute.name}' in node '${node.id}'.`,
        path: attributePath.property('bounds'),
        ref: node.id,
      }),
    ];
  }

  private validateKeyFlag(attribute: GAttribute, node: GNode, attributePath: DiagnosticPath): Diagnostic[] {
    if (attribute.isKey !== true) return [];

    const lowerBound: number = attribute.bounds.lowerBound;
    const upperBound: number = attribute.bounds.upperBound;

    const isSingleValued: boolean = upperBound === 1;
    const isRequired: boolean = lowerBound >= 1;

    if (isSingleValued && isRequired) return [];

    return [
      Diagnostics.warn({
        code: VALIDATION_ERROR.ATTRIBUTE_KEY_BOUNDS_INVALID,
        message: `Key attribute '${attribute.name}' in node '${node.id}' should have bounds 1..1.`,
        path: attributePath.property('bounds'),
        ref: node.id,
      }),
    ];
  }

  private validateTypeResolvable(
    validationContext: ValidationContext,
    attribute: GAttribute,
    node: GNode,
    attributePath: DiagnosticPath,
  ): Diagnostic[] {
    const isResolvable: boolean = this.isTypeRefResolvable(validationContext, attribute.typeId);
    if (isResolvable) return [];

    return [
      Diagnostics.error({
        code: VALIDATION_ERROR.ATTRIBUTE_TYPE_NOT_FOUND,
        message: `Attribute '${attribute.name}' in node '${node.id}' references unknown type '${attribute.typeId}'.`,
        path: attributePath.property('typeId'),
        ref: node.id,
      }),
    ];
  }

  private resolveInheritedAttributeNames(validationContext: ValidationContext, nodeId: Id): ReadonlySet<string> {
    const names: Set<string> = new Set<string>();
    const startModelId: Id = validationContext.derivedIndex.model.id;
    const chain: ReadonlyArray<ResolvedNode> = NodeResolver.resolveSuperTypeChain(
      startModelId,
      nodeId,
      validationContext.models,
    );

    for (const item of chain) {
      for (const attribute of item.node.attributes ?? []) {
        names.add(attribute.name);
      }
    }
    return names;
  }

  private isTypeRefResolvable(validationContext: ValidationContext, typeRef: TypeRef): boolean {
    if (Builtins.isBuiltin(typeRef)) return true;
    if (!Reference.isQualified(typeRef)) return validationContext.derivedIndex.dataTypesById.has(typeRef);

    const parts: QualifiedParts = Reference.splitQualified(typeRef);
    const closure: ReadonlyArray<GModel> = ModelResolver.resolveImports(
      validationContext.derivedIndex.model.id,
      validationContext.models,
    );

    const allowedModelIds: Set<Id> = new Set<Id>(closure.map((m: GModel): Id => m.id));
    if (!allowedModelIds.has(parts.modelId)) return false;

    const targetModel: GModel | undefined = validationContext.models.get(parts.modelId);
    if (!targetModel) return false;

    const targetIndex = new GModelIndex(targetModel);
    return targetIndex.dataTypesById.has(parts.refId);
  }
}
