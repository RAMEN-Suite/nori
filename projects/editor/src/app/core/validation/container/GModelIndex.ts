import { GDataType, GModel, GNode, GRelation } from '../../../models/GModel';

export class GModelIndex {
  public readonly importsByAlias: ReadonlyMap<string, string>;
  public readonly nodesById: ReadonlyMap<string, GNode>;
  public readonly dataTypesById: ReadonlyMap<string, GDataType>;
  public readonly relationsById: ReadonlyMap<string, GRelation>;

  constructor(public readonly model: GModel) {
    const imports: Map<string, string> = new Map<string, string>();
    for (const imp of this.model.imports) {
      imports.set(imp.alias, imp.modelId);
    }

    const nodes: Map<string, GNode> = new Map<string, GNode>();
    const dataTypes: Map<string, GDataType> = new Map<string, GDataType>();
    for (const classifier of model.classifiers) {
      if (classifier.kind === 'GNode') nodes.set(classifier.id, classifier);
      else if (classifier.kind === 'GDataType') dataTypes.set(classifier.id, classifier);
    }

    const relations: Map<string, GRelation> = new Map<string, GRelation>();
    for (const relation of model.relations) {
      relations.set(relation.id, relation);
    }

    this.importsByAlias = imports;
    this.nodesById = nodes;
    this.dataTypesById = dataTypes;
    this.relationsById = relations;
  }
}
