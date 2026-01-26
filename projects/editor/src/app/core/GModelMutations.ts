import { GAttribute, GClassifier, GDataType, GModel, GNode, GRelation, Id } from './models/GModel';

export type UpdateNodeInput = Partial<Pick<GNode, 'name' | 'superTypes' | 'attributes'>>;
export type UpdateDataTypeInput = Partial<Pick<GDataType, 'name' | 'literals'>>;
export type UpdateRelationInput = Partial<Pick<GRelation, 'name' | 'from' | 'to' | 'isBidirectional'>>;

export class GModelMutations {
  public static addClassifier(model: GModel, classifier: GClassifier): GModel {
    return { ...model, classifiers: [...(model.classifiers ?? []), classifier] };
  }

  public static removeClassifierById(model: GModel, classifierId: string): GModel {
    const classifiers: GClassifier[] = model.classifiers ?? [];

    const filtered: GClassifier[] = classifiers.filter((classifier: GClassifier): boolean => {
      return classifier.id !== classifierId;
    });
    if (filtered.length === classifiers.length) {
      throw new Error(`Classifier not found: ${classifierId}`);
    }

    return { ...model, classifiers: filtered };
  }

  public static updateNode(model: GModel, nodeId: string, patch: UpdateNodeInput): GModel {
    const classifiers: GClassifier[] = model.classifiers ?? [];
    let found: boolean = false;

    const patched: GClassifier[] = classifiers.map((classifier: GClassifier): GClassifier => {
      if (classifier.kind !== 'GNode') return classifier;
      if (classifier.id !== nodeId) return classifier;

      found = true;
      return { ...classifier, ...patch };
    });

    if (!found) throw new Error(`Node not found: ${nodeId}`);
    return { ...model, classifiers: patched };
  }

  public static updateDataType(model: GModel, dataTypeId: string, patch: UpdateDataTypeInput): GModel {
    const classifiers: GClassifier[] = model.classifiers ?? [];
    let found: boolean = false;

    const patched: GClassifier[] = classifiers.map((collection: GClassifier): GClassifier => {
      if (collection.kind !== 'GDataType') return collection;
      if (collection.id !== dataTypeId) return collection;

      found = true;
      return { ...collection, ...patch };
    });

    if (!found) throw new Error(`DataType not found: ${dataTypeId}`);
    return { ...model, classifiers: patched };
  }

  public static addRelation(model: GModel, relation: GRelation): GModel {
    return { ...model, relations: [...(model.relations ?? []), relation] };
  }

  public static removeRelationById(model: GModel, relationId: string): GModel {
    const relations: GRelation[] = model.relations ?? [];
    const filtered: GRelation[] = relations.filter((r: GRelation): boolean => r.id !== relationId);

    if (filtered.length === relations.length) {
      throw new Error(`Relation not found: ${relationId}`);
    }

    return { ...model, relations: filtered };
  }

  public static updateRelation(model: GModel, relationId: string, patch: UpdateRelationInput): GModel {
    const relations: GRelation[] = model.relations ?? [];
    let found: boolean = false;

    const patched: GRelation[] = relations.map((relation: GRelation): GRelation => {
      if (relation.id !== relationId) return relation;

      found = true;
      return { ...relation, ...patch };
    });

    if (!found) throw new Error(`Relation not found: ${relationId}`);
    return { ...model, relations: patched };
  }

  public static deleteNode(model: GModel, nodeId: string): GModel {
    let newModel: GModel = GModelMutations.removeClassifierById(model, nodeId);

    const relations: GRelation[] = newModel.relations ?? [];
    const remainingRelations: GRelation[] = relations.filter((relation: GRelation): boolean => {
      const fromId: Id = relation.from.nodeId;
      const toId: Id = relation.to.nodeId;
      return fromId !== nodeId && toId !== nodeId;
    });

    if (remainingRelations.length !== relations.length) {
      newModel = { ...newModel, relations: remainingRelations };
    }

    newModel = this.removeAttributesReferencingType(newModel, nodeId);
    return newModel;
  }

  public static deleteDataType(model: GModel, dataTypeId: string): GModel {
    let newModel: GModel = GModelMutations.removeClassifierById(model, dataTypeId);
    newModel = this.removeAttributesReferencingType(newModel, dataTypeId);
    return newModel;
  }

  private static removeAttributesReferencingType(model: GModel, typeId: string): GModel {
    const classifiers: GClassifier[] = model.classifiers ?? [];
    let changed: boolean = false;

    const patched: (GNode | GDataType)[] = classifiers.map((classifier: GClassifier): GNode | GDataType => {
      if (classifier.kind !== 'GNode') return classifier;
      const node: GNode = classifier;
      const attributes: GAttribute[] = node.attributes ?? [];

      const filtered: GAttribute[] = attributes.filter((attribute: GAttribute): boolean => attribute.typeId !== typeId);
      if (filtered.length === attributes.length) return classifier;

      changed = true;
      return { ...node, attributes: filtered };
    });

    return changed ? { ...model, classifiers: patched } : model;
  }
}
