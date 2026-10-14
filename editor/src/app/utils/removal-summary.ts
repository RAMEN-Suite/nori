import {
  ModelRef,
  type Model,
  type NodeRemovalPreview,
  type RelationRemovalPreview,
  type Node,
  type Relation,
} from '@ramen-suite/core/model';
import { type ModelRecord } from '../models/ModelRecord';

type ModelLevel = Pick<ModelRecord, 'gmodel' | 'slot' | 'projectId'>;

export interface AffectedLevel {
  readonly modelName: string;
  readonly modelSlot: number | null;
}

export interface RemovalLocation {
  readonly projectId: string;
  readonly slot: number;
  readonly nodeId: string;
  readonly relationId?: string;
}

export interface AffectedNode extends AffectedLevel {
  readonly relationshipCount: number;
  readonly propertyCount: number;
  readonly constraintCount: number;
  readonly name: string;
  readonly location?: RemovalLocation;
}

export interface AffectedRelation extends AffectedLevel {
  readonly constraintCount: number;
  readonly name: string;
  readonly location?: RemovalLocation;
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
      modelSlot: modelSlot(affected.modelId, levels),
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
      modelSlot: modelSlot(affected.modelId, levels),
    };
  });
}

export function getRemovedModelImpact(
  models: readonly Model[],
  removedModels: readonly Pick<Model, 'id' | 'name'>[],
  levels: readonly ModelLevel[],
): {
  affectedLevels: readonly AffectedLevel[];
  affectedNodes: readonly AffectedNode[];
  affectedRelations: readonly AffectedRelation[];
} {
  const removedIds: ReadonlySet<string> = new Set(removedModels.map((model): string => model.id));
  const removed: readonly Model[] = models.filter((model: Model): boolean => removedIds.has(model.id));
  return {
    affectedLevels: removedModels.map(
      (model: Pick<Model, 'id' | 'name'>): AffectedLevel => ({ modelName: model.name, modelSlot: modelSlot(model.id, levels) }),
    ),
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

function modelSlot(modelId: string, levels: readonly ModelLevel[]): number | null {
  return levels.find((level): boolean => level.gmodel.id === modelId)?.slot ?? null;
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
  nodeId: string,
  levels: readonly ModelLevel[],
  relationId?: string,
): RemovalLocation | undefined {
  const level: ModelLevel | undefined = levels.find((item): boolean => item.gmodel.id === modelId);
  return level ? { projectId: level.projectId, slot: level.slot, nodeId, relationId } : undefined;
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
