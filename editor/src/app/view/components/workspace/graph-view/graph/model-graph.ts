import { ModelRef, type Model, type Node, type Relation } from '@ramen-suite/core/model';

export interface GraphNode {
  readonly id: string;
  readonly kind: 'Node';
  readonly label: string;
  readonly superType: string;
  readonly baseName: string;
  readonly modelName: string;
}

export interface GraphLink {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: 'Relation';
  readonly label: string;
}

export interface GraphData {
  readonly nodes: GraphNode[];
  readonly links: GraphLink[];
}

export function buildModelGraph(
  model: Model | null,
  models: readonly Model[] = [],
  visibleNodeRefs: readonly string[] = [],
): GraphData {
  if (!model) return { nodes: [], links: [] };

  const nodes: Map<string, GraphNode> = new Map();
  const definitions: Map<string, Model> = new Map(models.map((item: Model): [string, Model] => [item.id, item]));
  for (const item of model.classifiers) {
    if (item.kind === 'Node') nodes.set(item.id, projectNode(item, item.id, model.id, definitions));
  }
  const references: Set<string> = new Set(visibleNodeRefs);
  for (const relation of model.relations) {
    references.add(relation.from.nodeId);
    references.add(relation.to.nodeId);
  }
  for (const ref of references) {
    if (nodes.has(ref)) continue;
    const node: GraphNode | null = projectReference(ref, model.id, definitions);
    if (node) nodes.set(ref, node);
  }

  const links: GraphLink[] = model.relations.map(
    (relation: Relation): GraphLink => ({
      id: relation.id,
      source: relation.from.nodeId,
      target: relation.to.nodeId,
      kind: 'Relation',
      label: relation.name,
    }),
  );
  return { nodes: [...nodes.values()], links };
}

function projectReference(ref: string, currentModelId: string, models: ReadonlyMap<string, Model>): GraphNode | null {
  if (!ModelRef.isQualified(ref)) return null;
  const { modelId, refId } = ModelRef.splitQualified(ref);
  if (modelId === currentModelId) return null;

  const node: Node | undefined = models
    .get(modelId)
    ?.classifiers.find((item): item is Node => item.kind === 'Node' && item.id === refId);
  return node ? projectNode(node, ref, modelId, models) : null;
}

function projectNode(node: Node, id: string, ownerId: string, models: ReadonlyMap<string, Model>): GraphNode {
  const base: string | undefined = node.superTypes[0];
  const ref: string | undefined = base && (ModelRef.isQualified(base) ? base : ModelRef.qualify(ownerId, base));
  const owner: { modelId: string; refId: string } | undefined = ref ? ModelRef.splitQualified(ref) : undefined;
  const baseName: string = owner
    ? (models.get(owner.modelId)?.classifiers.find((item): boolean => item.id === owner.refId)?.name ?? '')
    : '';

  return {
    id,
    kind: 'Node',
    label: node.name,
    superType: ModelRef.localId(base ?? node.id),
    baseName,
    modelName: models.get(ownerId)?.name ?? '',
  };
}

export function areGraphsEqual(previous: GraphData, current: GraphData): boolean {
  return (
    previous.nodes.length === current.nodes.length &&
    previous.links.length === current.links.length &&
    previous.nodes.every((node: GraphNode, index: number): boolean => sameNode(node, current.nodes[index])) &&
    previous.links.every((link: GraphLink, index: number): boolean => sameLink(link, current.links[index]))
  );
}

function sameNode(left: GraphNode, right: GraphNode | undefined): boolean {
  return (
    !!right &&
    left.id === right.id &&
    left.label === right.label &&
    left.superType === right.superType &&
    left.baseName === right.baseName &&
    left.modelName === right.modelName
  );
}

function sameLink(left: GraphLink, right: GraphLink | undefined): boolean {
  return (
    !!right && left.id === right.id && left.label === right.label && left.source === right.source && left.target === right.target
  );
}
