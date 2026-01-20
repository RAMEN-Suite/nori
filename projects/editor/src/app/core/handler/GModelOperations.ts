import { GAttribute, GClassifier, GDataType, GModel, GNode, GRelation, Id } from '../models/GModel';
import { GModelMutations } from './GModelMutations';

export class GModelOperations {
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

    const patched: (GNode | GDataType)[] = classifiers.map(
      (classifier: GClassifier): GNode | GDataType => {
        if (classifier.kind !== 'GNode') return classifier;
        const node: GNode = classifier;
        const attributes: GAttribute[] = node.attributes ?? [];

        const filtered: GAttribute[] = attributes.filter(
          (attribute: GAttribute): boolean => attribute.typeId !== typeId,
        );
        if (filtered.length === attributes.length) return classifier;

        changed = true;
        return { ...node, attributes: filtered };
      },
    );

    return changed ? { ...model, classifiers: patched } : model;
  }
}
