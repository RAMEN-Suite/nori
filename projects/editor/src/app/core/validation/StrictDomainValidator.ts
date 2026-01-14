import { Bounds, GAttribute, GClassifier, GModel, GNode, GRelation } from '../../models/GModel';
import { GModelIndex } from './container/GModelIndex';
import { Diagnostic, DiagnosticPath, DiagnosticReport, Diagnostics } from './container/Diagnostics';
import { VALIDATION_ERROR } from '../const/VALIDATION_ERROR';
import { BaseNode, StrictRules } from './rules/StrictRules';
import { Builtins } from './container/References';

export interface StrictValidateOptions {
  readonly baseId: string;
}

export class StrictDomainValidator {
  public validate(base: GModel, derived: GModel, options: StrictValidateOptions): Diagnostic[] {
    const baseIndex: GModelIndex = new GModelIndex(base);
    const derivedIndex: GModelIndex = new GModelIndex(derived);
    const diags: Diagnostic[] = [];

    if (!derivedIndex.importsByModelId.has(options.baseId)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.MISSING_BASE_IMPORT,
        message: `Derived model must import base with modelId '${options.baseId}'`,
        ref: options.baseId,
        path: DiagnosticPath.root().property('imports'),
      };

      diags.push(Diagnostics.error(report));
      return diags;
    }

    this.validateClassifiers(baseIndex, derivedIndex, options, diags);
    this.validateRelations(baseIndex, derivedIndex, options, diags);
    return diags;
  }

  private validateClassifiers(
    baseIndex: GModelIndex,
    derivedIndex: GModelIndex,
    options: StrictValidateOptions,
    diags: Diagnostic[],
  ): void {
    const classifiers: GClassifier[] = derivedIndex.model.classifiers ?? [];
    this.validateClassifierIdsUnique(classifiers, diags);

    classifiers.forEach((classifier: GClassifier, index: number): void => {
      const path: DiagnosticPath = DiagnosticPath.root().property('classifiers').index(index);

      if (classifier.kind === 'GNode') {
        const superType = StrictRules.getSingleBaseSupertype(classifier, options.baseId);

        if (!superType) {
          const report: DiagnosticReport = {
            code: VALIDATION_ERROR.NODE_SUPERTYPE_INVALID,
            message: `${classifier.id} must have exactly one superType.`,
            path: path.property('superTypes'),
            ref: classifier.id,
          };
          diags.push(Diagnostics.error(report));
          return;
        }

        const hasBaseNode: boolean = baseIndex.nodesById.has(superType.baseNodeId);
        if (!hasBaseNode) {
          const report: DiagnosticReport = {
            code: VALIDATION_ERROR.BASE_NODE_NOT_FOUND,
            message: `Base node ${superType.baseNodeId} not found.`,
            path: path.property('superTypes').index(0),
            ref: classifier.id,
          };
          diags.push(Diagnostics.error(report));
        }

        const isReserved: boolean = Builtins.isBuiltin(classifier.id);
        if (isReserved) {
          const report: DiagnosticReport = {
            code: VALIDATION_ERROR.NODE_ID_RESERVED,
            message: `Node id ${classifier.id} is reserved.`,
            path: path.property('id'),
            ref: classifier.id,
          };
          diags.push(Diagnostics.error(report));
        }

        this.validateNodeAttributes(
          baseIndex,
          derivedIndex,
          options.baseId,
          classifier,
          path,
          diags,
        );
      }

      if (classifier.kind === 'GDataType') {
        const isReserved: boolean = Builtins.isBuiltin(classifier.id);
        if (isReserved) {
          const report: DiagnosticReport = {
            code: VALIDATION_ERROR.DATATYPE_ID_RESERVED,
            message: `DataType id ${classifier.id} is reserved.`,
            path: path.property('id'),
            ref: classifier.id,
          };
          diags.push(Diagnostics.error(report));
        }
      }
    });
  }

  private validateClassifierIdsUnique(classifiers: GClassifier[], diags: Diagnostic[]): void {
    const iterated: Map<string, number> = new Map<string, number>();

    classifiers.forEach((classifier: GClassifier, index: number): void => {
      const previous: number | undefined = iterated.get(classifier.id);

      if (previous !== undefined) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.CLASSIFIER_ID_DUPLICATE,
          message: `Duplicate classifier id '${classifier.id}' (also at index ${previous}).`,
          path: DiagnosticPath.root().property('classifiers').index(index).property('id'),
          ref: classifier.id,
        };
        diags.push(Diagnostics.error(report));
      } else {
        iterated.set(classifier.id, index);
      }
    });
  }

  private validateNodeAttributes(
    baseIndex: GModelIndex,
    derivedIndex: GModelIndex,
    modelId: string,
    node: GNode,
    nodePath: DiagnosticPath,
    diags: Diagnostic[],
  ): void {
    const attributes: GAttribute[] = node.attributes ?? [];
    const inherited: ReadonlySet<string> = this.getBaseAttributeName(baseIndex, node, modelId);
    const iteratedNames: Set<string> = new Set<string>();

    attributes.forEach((attribute: GAttribute, index: number): void => {
      const path: DiagnosticPath = nodePath.property('attributes').index(index);

      if (iteratedNames.has(attribute.name)) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.ATTRIBUTE_NAME_DUPLICATE,
          message: `Duplicate attribute name '${attribute.name}' in node '${node.id}'.`,
          path: path.property('name'),
          ref: node.id,
        };
        diags.push(Diagnostics.error(report));
      } else {
        iteratedNames.add(attribute.name);
      }

      if (inherited.has(attribute.name)) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.ATTRIBUTE_NAME_SHADOWS_BASE,
          message: `Attribute '${attribute.name}' in node '${node.id}' conflicts with inherited base attribute.`,
          path: path.property('name'),
          ref: node.id,
        };
        diags.push(Diagnostics.error(report));
      }

      const bounds: Bounds = attribute.bounds;
      const isUpperAllowed: boolean =
        bounds.upperBound === -1 || bounds.upperBound >= bounds.lowerBound;
      const isLowerAllowed: boolean = bounds.lowerBound >= 0;

      if (!isUpperAllowed || !isLowerAllowed) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.ATTRIBUTE_BOUNDS_INVALID,
          message: `Invalid bounds for attribute '${attribute.name}' in node '${node.id}'.`,
          path: path.property('bounds'),
          ref: node.id,
        };
        diags.push(Diagnostics.error(report));
      }

      const typeId: string = attribute.typeId;
      const isBuiltin: boolean = Builtins.isBuiltin(typeId);
      const isDerivedLocalType: boolean = derivedIndex.dataTypesById.has(typeId);

      let isBaseQualifiedType: boolean = false;
      if (!isBuiltin && !isDerivedLocalType) {
        const baseTypeId: string | null = StrictRules.getBaseTypeId(typeId, modelId);
        if (baseTypeId) isBaseQualifiedType = baseIndex.dataTypesById.has(baseTypeId);
      }

      if (!isBuiltin && !isDerivedLocalType && !isBaseQualifiedType) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.ATTRIBUTE_TYPE_NOT_FOUND,
          message: `Attribute '${attribute.name}' in node '${node.id}' references unknown type '${typeId}'.`,
          path: path.property('typeId'),
          ref: node.id,
        };
        diags.push(Diagnostics.error(report));
      }
    });
  }

  private validateRelations(
    baseIndex: GModelIndex,
    derivedIndex: GModelIndex,
    options: StrictValidateOptions,
    diags: Diagnostic[],
  ): void {
    const relations: GRelation[] = derivedIndex.model.relations ?? [];

    relations.forEach((relation: GRelation, index: number): void => {
      const path: DiagnosticPath = DiagnosticPath.root().property('relations').index(index);

      const baseRelationId = StrictRules.getBaseRelationId(relation.id, options.baseId);
      if (!baseRelationId) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.RELATION_ID_INVALID,
          message: `Relation id must be '${options.baseId}:<baseRelationId>`,
          path: path.property('id'),
          ref: relation.id,
        };
        diags.push(Diagnostics.error(report));
        return;
      }

      const baseRelation: GRelation | undefined = baseIndex.relationsById.get(baseRelationId);
      if (!baseRelation) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.BASE_RELATION_NOT_FOUND,
          message: `Base relation '${baseRelationId}' not found.`,
          path: path.property('id'),
          ref: baseRelationId,
        };
        diags.push(Diagnostics.error(report));
        return;
      }

      if (!StrictRules.areRelationEndsLocal(relation)) {
        const report: DiagnosticReport = {
          code: VALIDATION_ERROR.RELATION_ENDS_NOT_LOCAL,
          message: `Relation ends must reference local nodes.`,
          path: path,
          ref: relation.id,
        };
        diags.push(Diagnostics.error(report));
        return;
      }

      this.validateRelationEnds(derivedIndex, options.baseId, relation, baseRelation, path, diags);
      this.validateRelationShape(relation, baseRelation, path, diags);
    });
  }

  private validateRelationEnds(
    derivedIndex: GModelIndex,
    baseId: string,
    dRelation: GRelation,
    bRelation: GRelation,
    path: DiagnosticPath,
    diags: Diagnostic[],
  ): void {
    const fromNodeId: string = dRelation.from.nodeId;
    const toNodeId: string = dRelation.to.nodeId;

    const fromNode: GNode | undefined = derivedIndex.nodesById.get(fromNodeId);
    if (!fromNode) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_FROM_NODE_NOT_FOUND,
        message: `From-node '${fromNodeId}' not found in derived model.`,
        path: path.property('from').property('nodeId'),
        ref: dRelation.id,
      };
      diags.push(Diagnostics.error(report));
      return;
    }

    const toNode: GNode | undefined = derivedIndex.nodesById.get(toNodeId);
    if (!toNode) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_TO_NODE_NOT_FOUND,
        message: `To-node '${toNodeId}' not found in derived model.`,
        path: path.property('to').property('nodeId'),
        ref: dRelation.id,
      };
      diags.push(Diagnostics.error(report));
      return;
    }

    const fromSuperType = StrictRules.getSingleBaseSupertype(fromNode, baseId);
    if (!fromSuperType) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.FROM_NODE_SUPERTYPE_INVALID,
        message: `From-node '${fromNode.id}' must have exactly one base superType.`,
        path: path.property('from').property('nodeId'),
        ref: dRelation.id,
      };
      diags.push(Diagnostics.error(report));
      return;
    }

    const toSuperType = StrictRules.getSingleBaseSupertype(toNode, baseId);
    if (!toSuperType) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.TO_NODE_SUPERTYPE_INVALID,
        message: `To-node '${toNode.id}' must have exactly one base superType.`,
        path: path.property('to').property('nodeId'),
        ref: dRelation.id,
      };
      diags.push(Diagnostics.error(report));
      return;
    }

    const expectedFromBaseId: string = bRelation.from.nodeId;
    const expectedToBaseId: string = bRelation.to.nodeId;

    if (fromSuperType.baseNodeId !== expectedFromBaseId) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_FROM_INCOMPATIBLE,
        message: `From-node '${fromNode.id}' must specialize base '${expectedFromBaseId}'.`,
        path: path.property('from').property('nodeId'),
        ref: dRelation.id,
      };
      diags.push(Diagnostics.error(report));
    }

    if (toSuperType.baseNodeId !== expectedToBaseId) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_TO_INCOMPATIBLE,
        message: `To-node '${toNode.id}' must specialize base '${expectedToBaseId}'.`,
        path: path.property('to').property('nodeId'),
        ref: dRelation.id,
      };
      diags.push(Diagnostics.error(report));
    }
  }

  private validateRelationShape(
    dRelation: GRelation,
    bRelation: GRelation,
    path: DiagnosticPath,
    diags: Diagnostic[],
  ): void {
    if (dRelation.name !== bRelation.name) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_NAME_MISMATCH,
        message: `Relation name must be ${bRelation.name}.`,
        path: path.property('name'),
      };
      diags.push(Diagnostics.error(report));
    }

    const isFromRoleMatching: boolean = dRelation.from.role === bRelation.from.role;
    const isToRoleMatching: boolean = dRelation.to.role === bRelation.to.role;
    if (!isFromRoleMatching || !isToRoleMatching) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_ROLE_MISMATCH,
        message: `Relation roles must match base.`,
        path: path,
      };
      diags.push(Diagnostics.error(report));
    }

    if (!StrictRules.isDerivedBoundsCompatible(bRelation.from.bounds, dRelation.from.bounds)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_FROM_BOUNDS_INVALID,
        message: `from.bounds must be a specification of base bounds.`,
        path: path.property('from').property('bounds'),
      };
      diags.push(Diagnostics.error(report));
    }

    if (!StrictRules.isDerivedBoundsCompatible(bRelation.to.bounds, dRelation.to.bounds)) {
      const report: DiagnosticReport = {
        code: VALIDATION_ERROR.RELATION_TO_BOUNDS_INVALID,
        message: `to.bounds must be a specification of base bounds.`,
        path: path.property('to').property('bounds'),
      };
      diags.push(Diagnostics.error(report));
    }
  }

  private getBaseAttributeName(
    baseIndex: GModelIndex,
    node: GNode,
    baseId: string,
  ): ReadonlySet<string> {
    const superType: BaseNode | null = StrictRules.getSingleBaseSupertype(node, baseId);
    if (!superType) return new Set<string>();

    const baseNode: GNode | undefined = baseIndex.nodesById.get(superType.baseNodeId);
    if (!baseNode) return new Set<string>();

    const names: Set<string> = new Set<string>();
    const attributes: GAttribute[] = baseNode.attributes ?? [];
    for (const attribute of attributes) names.add(attribute.name);

    return names;
  }
}
