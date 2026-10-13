import {
  ModelRef,
  type Model,
  type NodeRemovalPreview,
  type RelationRemovalPreview,
  type Node,
  type Relation,
} from '@ramen-suite/core/model';
import { type ModelRecord } from '../../models/ModelRecord';

type ModelLevel = Pick<ModelRecord, 'gmodel' | 'slot'>;

export interface AffectedLevel {
  readonly modelName: string;
  readonly modelSlot: number | null;
}

export interface AffectedNode extends AffectedLevel {
  readonly name: string;
}

export interface AffectedRelation extends AffectedLevel {
  readonly name: string;
  readonly from: string;
  readonly to: string;
}

export function getAffectedNodes(
  models: readonly Model[],
  preview: NodeRemovalPreview,
  levels: readonly ModelLevel[],
): readonly AffectedNode[] {
  const byId: ReadonlyMap<string, Model> = new Map(models.map((model) => [model.id, model]));
  return preview.nodes.map(
    (affected): AffectedNode => ({
      name: resolveNode(byId, affected.modelId, affected.elementId)?.name ?? affected.elementId,
      modelName: byId.get(affected.modelId)?.name ?? '',
      modelSlot: modelSlot(affected.modelId, levels),
    }),
  );
}

export function getAffectedRelations(
  models: readonly Model[],
  preview: RelationRemovalPreview,
  levels: readonly ModelLevel[],
): readonly AffectedRelation[] {
  const byId: ReadonlyMap<string, Model> = new Map(models.map((model) => [model.id, model]));
  return preview.relations.map((affected): AffectedRelation => {
    const model: Model | undefined = byId.get(affected.modelId);
    const relation: Relation | undefined = model?.relations.find((item): boolean => item.id === affected.elementId);
    return {
      name: relation?.name ?? affected.elementId,
      from: relation ? (resolveNode(byId, affected.modelId, relation.from.nodeId)?.name ?? relation.from.nodeId) : '',
      to: relation ? (resolveNode(byId, affected.modelId, relation.to.nodeId)?.name ?? relation.to.nodeId) : '',
      modelName: model?.name ?? '',
      modelSlot: modelSlot(affected.modelId, levels),
    };
  });
}

function modelSlot(modelId: string, levels: readonly ModelLevel[]): number | null {
  return levels.find((level): boolean => level.gmodel.id === modelId)?.slot ?? null;
}

function resolveNode(models: ReadonlyMap<string, Model>, ownerId: string, reference: string): Node | undefined {
  const modelId: string = ModelRef.isQualified(reference) ? ModelRef.splitQualified(reference).modelId : ownerId;
  const nodeId: string = ModelRef.localId(reference);
  return models.get(modelId)?.classifiers.find((item): item is Node => item.kind === 'Node' && item.id === nodeId);
}
