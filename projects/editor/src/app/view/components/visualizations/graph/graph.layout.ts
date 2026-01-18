import * as d3 from 'd3';
import { GraphData, GraphLink, GraphNode } from '../../../../core/GModelGraph';
import {
  GraphInputModel,
  GraphLayoutMode,
  GraphLayoutSettings,
  PositionedNode,
  RenderModel,
  ResolvedLink,
  ViewportSize,
} from './graph.types';

type HierarchyDatum = Readonly<{
  id: string;
  node?: PositionedNode;
  children?: HierarchyDatum[];
}>;

export function buildRenderModel(input: GraphInputModel): RenderModel {
  const nodes: PositionedNode[] = createNodes(input.data);
  const links: ResolvedLink[] = createLinks(input.data, nodes);

  const nodesById: Map<string, PositionedNode> = new Map(
    nodes.map((node: PositionedNode): [string, PositionedNode] => [node.id, node]),
  );

  const visibleModel: { nodes: PositionedNode[]; links: ResolvedLink[] } = applyVisibility(
    nodes,
    links,
    input.settings,
  );

  applyLayout(visibleModel.nodes, visibleModel.links, input.viewport, input.settings);

  return {
    nodes: visibleModel.nodes,
    links: visibleModel.links,
    nodesById,
  };
}

export function getViewportSize(hostElement: HTMLDivElement): ViewportSize {
  return {
    width: hostElement.clientWidth || 800,
    height: hostElement.clientHeight || 500,
  };
}

export function setNodePosition(node: PositionedNode, x: number, y: number): void {
  node.x = x;
  node.y = y;
  node.baseX = x;
  node.baseY = y;
}

function createNodes(data: GraphData): PositionedNode[] {
  return data.nodes.map(
    (node: GraphNode): PositionedNode => ({
      ...node,
      x: 0,
      y: 0,
      baseX: 0,
      baseY: 0,
    }),
  );
}

function createLinks(data: GraphData, nodes: PositionedNode[]): ResolvedLink[] {
  const nodesById: Map<string, PositionedNode> = new Map(
    nodes.map((node: PositionedNode): [string, PositionedNode] => [node.id, node]),
  );

  return data.links
    .map((link: GraphLink): ResolvedLink | null => {
      const sourceNode: PositionedNode | undefined = nodesById.get(String(link.source));
      const targetNode: PositionedNode | undefined = nodesById.get(String(link.target));
      if (!sourceNode || !targetNode) return null;
      return { ...link, source: sourceNode, target: targetNode };
    })
    .filter((link: ResolvedLink | null): link is ResolvedLink => link !== null);
}

function applyVisibility(
  nodes: PositionedNode[],
  links: ResolvedLink[],
  settings: GraphLayoutSettings,
): { nodes: PositionedNode[]; links: ResolvedLink[] } {
  if (!settings.areIsolatedNodesHidden) return { nodes, links };

  const degreesByNodeId: Map<string, number> = computeDegrees(nodes, links);
  const visibleNodes: PositionedNode[] = nodes.filter(
    (node: PositionedNode): boolean => (degreesByNodeId.get(node.id) ?? 0) > 0,
  );
  const visibleNodeIds: Set<string> = new Set(
    visibleNodes.map((node: PositionedNode): string => node.id),
  );
  const visibleLinks: ResolvedLink[] = links.filter(
    (link: ResolvedLink): boolean =>
      visibleNodeIds.has(link.source.id) && visibleNodeIds.has(link.target.id),
  );

  return { nodes: visibleNodes, links: visibleLinks };
}

function applyLayout(
  nodes: PositionedNode[],
  links: ResolvedLink[],
  viewport: ViewportSize,
  settings: GraphLayoutSettings,
): void {
  const degreesByNodeId: Map<string, number> = computeDegrees(nodes, links);

  const connectedNodes: PositionedNode[] = [];
  const isolatedNodes: PositionedNode[] = [];

  for (const node of nodes) {
    const degree: number = degreesByNodeId.get(node.id) ?? 0;
    if (degree > 0) connectedNodes.push(node);
    else isolatedNodes.push(node);
  }

  const isolatedArea: { reservedHeight: number } = computeIsolatedArea(
    isolatedNodes.length,
    viewport,
    settings,
  );

  applyConnectedLayout(connectedNodes, links, viewport, settings, isolatedArea);
  if (settings.areIsolatedNodesHidden) return;
  applyIsolatedLayout(isolatedNodes, viewport, settings, isolatedArea);
}

function computeIsolatedArea(
  isolatedCount: number,
  viewport: ViewportSize,
  settings: GraphLayoutSettings,
): { reservedHeight: number } {
  if (isolatedCount === 0 || settings.areIsolatedNodesHidden) return { reservedHeight: 0 };

  const columns: number = Math.max(1, settings.isolatedColumns);
  const rowCount: number = Math.ceil(isolatedCount / columns);

  const reservedHeight: number = rowCount * settings.isolatedRowGap + settings.isolatedAreaGap;
  return { reservedHeight: Math.min(reservedHeight, Math.max(0, viewport.height * 0.5)) };
}

function applyConnectedLayout(
  nodes: PositionedNode[],
  links: ResolvedLink[],
  viewport: ViewportSize,
  settings: GraphLayoutSettings,
  isolatedArea: { reservedHeight: number },
): void {
  if (nodes.length === 0) return;

  const mode: GraphLayoutMode = settings.layoutMode;
  const hierarchyRoot: d3.HierarchyNode<HierarchyDatum> = buildHierarchyForest(nodes, links);

  const padding = settings.padding;
  const innerWidth: number = Math.max(1, viewport.width - padding.left - padding.right);
  const innerHeight: number = Math.max(
    1,
    viewport.height - padding.top - padding.bottom - isolatedArea.reservedHeight,
  );

  const layout = mode === 'treeTopDown' ? d3.tree<HierarchyDatum>() : d3.cluster<HierarchyDatum>();
  layout.nodeSize([settings.nodeSeparation, settings.layerGap]);

  const positionedRoot: d3.HierarchyPointNode<HierarchyDatum> = layout(hierarchyRoot as any) as any;
  const descendants: d3.HierarchyPointNode<HierarchyDatum>[] = positionedRoot.descendants();

  const realNodes: d3.HierarchyPointNode<HierarchyDatum>[] = descendants.filter(
    (item: d3.HierarchyPointNode<HierarchyDatum>) => Boolean(item.data.node),
  );
  if (realNodes.length === 0) return;

  const bounds = computeHierarchyBounds(realNodes);
  const offsetX: number = padding.left + (innerWidth - bounds.width) / 2 - bounds.minX;
  const offsetY: number = padding.top + (innerHeight - bounds.height) / 2 - bounds.minY;

  for (const hierarchyNode of realNodes) {
    const dataNode: PositionedNode = hierarchyNode.data.node!;
    setNodePosition(dataNode, hierarchyNode.x + offsetX, hierarchyNode.y + offsetY);
  }
}

function applyIsolatedLayout(
  nodes: PositionedNode[],
  viewport: ViewportSize,
  settings: GraphLayoutSettings,
  isolatedArea: { reservedHeight: number },
): void {
  if (nodes.length === 0) return;

  const padding = settings.padding;
  const innerWidth: number = Math.max(1, viewport.width - padding.left - padding.right);
  const innerHeight: number = Math.max(1, viewport.height - padding.top - padding.bottom);

  const columns: number = Math.max(1, settings.isolatedColumns);
  const usedColumns: number = Math.min(columns, nodes.length);

  const gridWidth: number = (usedColumns - 1) * settings.isolatedColumnGap;
  const startX: number = padding.left + (innerWidth - gridWidth) / 2;

  const startY: number =
    padding.top + innerHeight - isolatedArea.reservedHeight + settings.isolatedAreaGap;
  const sortedNodes: PositionedNode[] = [...nodes].sort((a: PositionedNode, b: PositionedNode) =>
    (a.label ?? a.id).localeCompare(b.label ?? b.id),
  );

  sortedNodes.forEach((node: PositionedNode, index: number): void => {
    const columnIndex: number = index % columns;
    const rowIndex: number = Math.floor(index / columns);

    const xPosition: number = startX + columnIndex * settings.isolatedColumnGap;
    const yPosition: number = startY + rowIndex * settings.isolatedRowGap;

    setNodePosition(node, xPosition, yPosition);
  });
}

function computeDegrees(nodes: PositionedNode[], links: ResolvedLink[]): Map<string, number> {
  const degreesByNodeId: Map<string, number> = new Map(
    nodes.map((node: PositionedNode): [string, number] => [node.id, 0]),
  );

  for (const link of links) {
    degreesByNodeId.set(link.source.id, (degreesByNodeId.get(link.source.id) ?? 0) + 1);
    degreesByNodeId.set(link.target.id, (degreesByNodeId.get(link.target.id) ?? 0) + 1);
  }

  return degreesByNodeId;
}

function buildHierarchyForest(
  nodes: PositionedNode[],
  links: ResolvedLink[],
): d3.HierarchyNode<HierarchyDatum> {
  const nodesById: Map<string, PositionedNode> = new Map(
    nodes.map((node: PositionedNode): [string, PositionedNode] => [node.id, node]),
  );
  const childrenById: Map<string, string[]> = new Map(
    nodes.map((node: PositionedNode): [string, never[]] => [node.id, []]),
  );
  const indegreeById: Map<string, number> = new Map(
    nodes.map((node: PositionedNode): [string, number] => [node.id, 0]),
  );

  for (const link of links) {
    const sourceId: string = link.source.id;
    const targetId: string = link.target.id;

    if (!nodesById.has(sourceId) || !nodesById.has(targetId)) continue;
    childrenById.get(sourceId)!.push(targetId);
    indegreeById.set(targetId, (indegreeById.get(targetId) ?? 0) + 1);
  }

  const rootIds: string[] = [];
  for (const [nodeId, indegree] of indegreeById.entries()) {
    if (indegree === 0) rootIds.push(nodeId);
  }

  const sortedFallback: PositionedNode | undefined = [...nodes].sort(
    (a: PositionedNode, b: PositionedNode): number =>
      (a.label ?? a.id).localeCompare(b.label ?? b.id),
  )[0];
  const visited: Set<string> = new Set<string>();

  const buildSubtree: (nodeId: string) => HierarchyDatum | null = (
    nodeId: string,
  ): HierarchyDatum | null => {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const node: PositionedNode | undefined = nodesById.get(nodeId);
    if (!node) return null;

    const childItems: HierarchyDatum[] = [];
    for (const childId of childrenById.get(nodeId) ?? []) {
      const childTree: HierarchyDatum | null = buildSubtree(childId);
      if (childTree) childItems.push(childTree);
    }

    return {
      id: nodeId,
      node,
      children: childItems.length ? childItems : undefined,
    };
  };

  const forestChildren: HierarchyDatum[] = [];

  for (const rootId of rootIds) {
    const rootTree: HierarchyDatum | null = buildSubtree(rootId);
    if (rootTree) forestChildren.push(rootTree);
  }

  if (forestChildren.length === 0 && sortedFallback) {
    const rootTree: HierarchyDatum | null = buildSubtree(sortedFallback.id);
    if (rootTree) forestChildren.push(rootTree);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const remainderTree: HierarchyDatum | null = buildSubtree(node.id);
      if (remainderTree) forestChildren.push(remainderTree);
    }
  }

  const virtualRoot: HierarchyDatum = {
    id: '__virtual_root__',
    children: forestChildren.length ? forestChildren : undefined,
  };

  return d3.hierarchy(virtualRoot, (datum: HierarchyDatum) => datum.children);
}

function computeHierarchyBounds(nodes: Array<d3.HierarchyPointNode<HierarchyDatum>>): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX: number = Number.POSITIVE_INFINITY;
  let maxX: number = Number.NEGATIVE_INFINITY;
  let minY: number = Number.POSITIVE_INFINITY;
  let maxY: number = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}
