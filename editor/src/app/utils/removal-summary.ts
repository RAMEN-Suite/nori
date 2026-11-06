import {
  ModelRef,
  type Model,
  type NodeRemovalPreview,
  type RelationRemovalPreview,
  type Node,
  type Relation,
} from '@ramen-suite/core/model';
import { type ModelRecord } from '../models/ModelRecord';
import { type WorkspaceLocation } from '../models/WorkspaceLocation';

type ModelLevel = Pick<ModelRecord, 'gmodel' | 'levelIndex' | 'projectId'>;

export interface AffectedLevel {
  readonly modelName: string;
  readonly modelLevelIndex: number | null;
  readonly location?: WorkspaceLocation;
}

export interface AffectedModelLevel extends AffectedLevel {
  readonly nodeCount: number;
  readonly relationCount: number;
}

export interface AffectedNode extends AffectedLevel {
  readonly relationshipCount: number;
  readonly propertyCount: number;
  readonly constraintCount: number;
  readonly name: string;
}

export interface AffectedRelation extends AffectedLevel {
  readonly constraintCount: number;
  readonly name: string;
  readonly from: string;
  readonly to: string;
}

export function getAffectedNodes(
  models: readonly Model[],
  preview: Pick<NodeRemovalPreview, 'nodes'>,
  levels: readonly ModelLevel[],
): readonly AffectedNode[] {
  const byId: ReadonlyMap<string, Model> = new Map(models.map((model) => [model.id, model]));
  return preview.nodes.map((affected): AffectedNode => {
    const node: Node | undefined = resolveNode(byId, affected.modelId, affected.elementId);
    return {
      name: node?.name ?? affected.elementId,
      relationshipCount: countNodeRelationships(byId, affected.modelId, affected.elementId),
      propertyCount: node?.attributes.length ?? 0,
      constraintCount: countNodeConstraints(node),
      location: removalLocation(affected.modelId, affected.elementId, levels),
      modelName: byId.get(affected.modelId)?.name ?? '',
      modelLevelIndex: modelLevelIndex(affected.modelId, levels),
    };
  });
}

export function getAffectedRelations(
  models: readonly Model[],
  preview: Pick<RelationRemovalPreview, 'relations'>,
  levels: readonly ModelLevel[],
): readonly AffectedRelation[] {
  const byId: ReadonlyMap<string, Model> = new Map(models.map((model) => [model.id, model]));
  return preview.relations.map((affected): AffectedRelation => {
    const model: Model | undefined = byId.get(affected.modelId);
    const relation: Relation | undefined = model?.relations.find((item): boolean => item.id === affected.elementId);
    return {
      name: relation?.name ?? affected.elementId,
      constraintCount: countRelationConstraints(relation),
      location: relation ? removalLocation(affected.modelId, relation.from.nodeId, levels, relation.id) : undefined,
      from: relation ? resolveNodeName(byId, affected.modelId, relation.from.nodeId) : '',
      to: relation ? resolveNodeName(byId, affected.modelId, relation.to.nodeId) : '',
      modelName: model?.name ?? '',
      modelLevelIndex: modelLevelIndex(affected.modelId, levels),
    };
  });
}

export interface ModelRemovalImpact {
  readonly affectedLevels: readonly AffectedModelLevel[];
  readonly affectedNodes: readonly AffectedNode[];
  readonly affectedRelations: readonly AffectedRelation[];
}

export function getRemovedModelImpact(
  models: readonly Model[],
  removedModels: readonly Pick<Model, 'id' | 'name'>[],
  levels: readonly ModelLevel[],
  selectedModelId: string,
): ModelRemovalImpact {
  const removedIds: ReadonlySet<string> = new Set(removedModels.map((model): string => model.id));
  const removed: readonly Model[] = models.filter((model: Model): boolean => removedIds.has(model.id));
  return {
    affectedLevels: getAffectedModelLevels(removed, levels, selectedModelId),
    affectedNodes: getAffectedNodes(
      models,
      {
        nodes: removed.flatMap((model: Model) =>
          model.classifiers.filter((item) => item.kind === 'Node').map((node) => ({ modelId: model.id, elementId: node.id })),
        ),
      },
      levels,
    ),
    affectedRelations: getAffectedRelations(
      models,
      {
        relations: removed.flatMap((model: Model) =>
          model.relations.map((relation) => ({ modelId: model.id, elementId: relation.id })),
        ),
      },
      levels,
    ),
  };
}

function getAffectedModelLevels(
  models: readonly Model[],
  levels: readonly ModelLevel[],
  selectedModelId: string,
): readonly AffectedModelLevel[] {
  return models
    .filter((model: Model): boolean => model.id !== selectedModelId)
    .map((model: Model): AffectedModelLevel => ({
      modelName: model.name,
      modelLevelIndex: modelLevelIndex(model.id, levels),
      location: removalLocation(model.id, undefined, levels),
      nodeCount: model.classifiers.filter((item): boolean => item.kind === 'Node').length,
      relationCount: model.relations.length,
    }));
}

function modelLevelIndex(modelId: string, levels: readonly ModelLevel[]): number | null {
  return levels.find((level): boolean => level.gmodel.id === modelId)?.levelIndex ?? null;
}

function resolveNode(models: ReadonlyMap<string, Model>, ownerId: string, reference: string): Node | undefined {
  const modelId: string = ModelRef.isQualified(reference) ? ModelRef.splitQualified(reference).modelId : ownerId;
  const nodeId: string = ModelRef.localId(reference);
  return models.get(modelId)?.classifiers.find((item): item is Node => item.kind === 'Node' && item.id === nodeId);
}

function resolveNodeName(models: ReadonlyMap<string, Model>, ownerId: string, reference: string): string {
  return resolveNode(models, ownerId, reference)?.name ?? reference;
}

function removalLocation(
  modelId: string,
  nodeId: string | undefined,
  levels: readonly ModelLevel[],
  relationId?: string,
): WorkspaceLocation | undefined {
  const level: ModelLevel | undefined = levels.find((item): boolean => item.gmodel.id === modelId);
  return level ? { projectId: level.projectId, levelIndex: level.levelIndex, nodeId, relationId } : undefined;
}

function countNodeRelationships(models: ReadonlyMap<string, Model>, modelId: string, nodeId: string): number {
  let count: number = 0;
  for (const model of models.values()) {
    for (const relation of model.relations) {
      if (
        referencesNode(relation.from.nodeId, model.id, modelId, nodeId) ||
        referencesNode(relation.to.nodeId, model.id, modelId, nodeId)
      )
        count++;
    }
  }
  return count;
}

function referencesNode(reference: string, ownerId: string, modelId: string, nodeId: string): boolean {
  const referencedModel: string = ModelRef.isQualified(reference) ? ModelRef.splitQualified(reference).modelId : ownerId;
  return referencedModel === modelId && ModelRef.localId(reference) === nodeId;
}

function countNodeConstraints(node: Node | undefined): number {
  if (!node) return 0;
  return (
    (node.constraints?.length ?? 0) +
    node.attributes.reduce((count: number, attribute): number => count + (attribute.constraints?.length ?? 0), 0)
  );
}

function countRelationConstraints(relation: Relation | undefined): number {
  if (!relation) return 0;
  return (relation.constraints?.length ?? 0) + (relation.from.constraints?.length ?? 0) + (relation.to.constraints?.length ?? 0);
}
