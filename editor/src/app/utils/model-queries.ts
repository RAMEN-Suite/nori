import {
  ModelRef,
  type Attribute,
  type Model,
  type Node,
  type NodeLineageItem,
  type ProjectValidationResult,
  type RelationSuggestion,
} from '@ramen-suite/core/model';
import { type RamenModel } from '@ramen-suite/core/ramen';
import { type ModelRecord } from '../models/ModelRecord';
import { type InheritedAttribute, type NodeDefinition } from '../models/WorkspaceDetails';

/** Adapts Core model queries to editor lists without reading or changing application state. */
export class ModelQueries {
  public static nodes(model: Model | null | undefined): readonly Node[] {
    return model?.classifiers.filter((item): item is Node => item.kind === 'Node') ?? [];
  }

  public static parentNodeName(node: Node, modelId: string, models: ReadonlyMap<string, Model>): string | undefined {
    const reference: string | undefined = node.superTypes[0];
    if (!reference) return undefined;

    const { modelId: parentModelId, refId } = ModelRef.isQualified(reference)
      ? ModelRef.splitQualified(reference)
      : { modelId, refId: reference };
    return models.get(parentModelId)?.classifiers.find((item): boolean => item.kind === 'Node' && item.id === refId)?.name;
  }

  public static nodeAncestors(draft: RamenModel, reference: string): readonly NodeDefinition[] {
    const lineage: readonly NodeLineageItem[] = draft.getNodeLineage(reference);
    return lineage.slice(0, -1).flatMap((item): NodeDefinition[] => {
      const node: Node | undefined = draft.getNode(item);
      return node ? [{ modelId: item.modelId, node }] : [];
    });
  }

  public static inheritedAttributes(
    draft: RamenModel,
    reference: string,
    records: ReadonlyMap<string, ModelRecord>,
  ): ReadonlyMap<string, readonly InheritedAttribute[]> {
    const groups: Map<string, InheritedAttribute[]> = new Map();
    for (const info of draft.getAttributes(reference)) {
      if (!info.inherited) continue;
      const owner: Node | undefined = draft.getNode(info.declaredBy);
      const attribute: Attribute | undefined = owner?.attributes.find((item): boolean => item.id === info.attributeId);
      const record: ModelRecord | undefined = records.get(info.declaredBy.modelId);
      if (!owner || !attribute || !record) continue;

      const key: string = info.declaredBy.ref;
      const items: InheritedAttribute[] = groups.get(key) ?? [];
      items.push({
        levelIndex: record.levelIndex,
        modelId: info.declaredBy.modelId,
        nodeId: owner.id,
        nodeName: owner.name,
        attribute,
      });
      groups.set(key, items);
    }
    return groups;
  }

  public static specificRelations(
    choices: readonly RelationSuggestion[],
    validation: ProjectValidationResult,
  ): readonly RelationSuggestion[] {
    if (!validation.valid) return choices;
    const ancestors: Set<string> = new Set();
    for (const choice of choices) {
      for (const ancestor of validation.graph.getRelationAncestors(choice.modelId, choice.relationId)) {
        ancestors.add(ModelRef.qualify(ancestor.modelId, ancestor.element.id));
      }
    }
    return choices.filter((choice): boolean => !ancestors.has(choice.ref));
  }
}
