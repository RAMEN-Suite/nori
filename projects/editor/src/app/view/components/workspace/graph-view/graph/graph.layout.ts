import * as d3 from 'd3';
import { GraphData, GraphLink, GraphNode } from '../../../../../core/utils/GModelGraph';
import {
  GraphInputModel,
  GraphLayoutMode,
  GraphLayoutSettings,
  GraphPadding,
  PositionedNode,
  RenderModel,
  ResolvedLink,
  ViewportSize,
} from './graph.types';

type Hierarchy = Readonly<{ id: string; node?: PositionedNode; children?: Hierarchy[] }>;
type Bounds = { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };

export function buildRenderModel(input: GraphInputModel): RenderModel {
  const nodes: PositionedNode[] = createNodes(input.data);
  const nodesById: Map<string, PositionedNode> = new Map<string, PositionedNode>(
    nodes.map((node: PositionedNode): [string, PositionedNode] => [node.id, node]),
  );

  const links: ResolvedLink[] = createLinks(input.data, nodesById);
  const visible: { nodes: PositionedNode[]; links: ResolvedLink[] } = applyVisibility(nodes, links, input.settings);
  applyLayout(visible.nodes, visible.links, input.viewport, input.settings);

  return { nodes: visible.nodes, links: visible.links, nodesById };
}

export function getViewportSize(hostElement: HTMLDivElement): ViewportSize {
  return { width: hostElement.clientWidth || 800, height: hostElement.clientHeight || 500 };
}

export function setNodePosition(node: PositionedNode, x: number, y: number): void {
  node.x = x;
  node.y = y;
  node.baseX = x;
  node.baseY = y;
}

function createNodes(data: GraphData): PositionedNode[] {
  return data.nodes.map((node: GraphNode): PositionedNode => ({ ...node, x: 0, y: 0, baseX: 0, baseY: 0 }));
}

function createLinks(data: GraphData, nodesById: Map<string, PositionedNode>): ResolvedLink[] {
  return data.links
    .map((link: GraphLink): ResolvedLink | null => {
      const sourceNode: PositionedNode | undefined = nodesById.get(link.source);
      const targetNode: PositionedNode | undefined = nodesById.get(link.target);

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

  const degrees: Map<string, number> = computeDegrees(nodes, links);
  const visible: PositionedNode[] = nodes.filter((node: PositionedNode): boolean => (degrees.get(node.id) ?? 0) > 0);

  const visibleNodeIds: Set<string> = new Set<string>(visible.map((node: PositionedNode): string => node.id));
  const visibleLinks: ResolvedLink[] = links.filter((link: ResolvedLink): boolean => {
    const nodeHasSource: boolean = visibleNodeIds.has(link.source.id);
    const nodeHasTarget: boolean = visibleNodeIds.has(link.target.id);
    return nodeHasSource && nodeHasTarget;
  });

  return { nodes: visible, links: visibleLinks };
}

function applyLayout(
  nodes: PositionedNode[],
  links: ResolvedLink[],
  viewport: ViewportSize,
  settings: GraphLayoutSettings,
): void {
  const degrees: Map<string, number> = computeDegrees(nodes, links);
  const connectedNodes: PositionedNode[] = [];
  const isolatedNodes: PositionedNode[] = [];

  for (const node of nodes) {
    const degree: number = degrees.get(node.id) ?? 0;
    if (degree > 0) connectedNodes.push(node);
    else isolatedNodes.push(node);
  }

  const isolatedArea: { reservedHeight: number } = computeIsolatedArea(isolatedNodes.length, viewport, settings);

  applyConnectedLayout(connectedNodes, links, viewport, settings, isolatedArea);
  if (settings.areIsolatedNodesHidden) return;
  applyIsolatedLayout(isolatedNodes, viewport, settings, isolatedArea);
}

function computeIsolatedArea(
  amount: number,
  viewport: ViewportSize,
  settings: GraphLayoutSettings,
): { reservedHeight: number } {
  if (amount === 0 || settings.areIsolatedNodesHidden) return { reservedHeight: 0 };

  const columns: number = Math.max(1, settings.isolatedColumns);
  const rowCount: number = Math.ceil(amount / columns);

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
  const hierarchyRoot: d3.HierarchyNode<Hierarchy> = buildHierarchy(nodes, links);

  const padding: Readonly<GraphPadding> = settings.padding;
  const innerWidth: number = Math.max(1, viewport.width - padding.left - padding.right);
  const innerHeightTotal: number = Math.max(1, viewport.height - padding.top - padding.bottom);

  const layout: d3.TreeLayout<Hierarchy> | d3.ClusterLayout<Hierarchy> =
    mode === 'treeTopDown' ? d3.tree<Hierarchy>() : d3.cluster<Hierarchy>();
  layout.nodeSize([settings.nodeSeparation, settings.layerGap]);

  const positionedRoot: d3.HierarchyPointNode<Hierarchy> = layout(hierarchyRoot);
  const descendants: d3.HierarchyPointNode<Hierarchy>[] = positionedRoot.descendants();

  const realNodes: d3.HierarchyPointNode<Hierarchy>[] = descendants.filter(
    (item: d3.HierarchyPointNode<Hierarchy>): boolean => Boolean(item.data.node),
  );
  if (realNodes.length === 0) return;

  const bounds: Bounds = computeBounds(realNodes);

  const startY: number = padding.top + innerHeightTotal - isolatedArea.reservedHeight + settings.isolatedAreaGap;
  const connectedBottomLimitY: number = startY - settings.isolatedAreaGap;

  const offsetX: number = padding.left + (innerWidth - bounds.width) / 2 - bounds.minX;
  const offsetY: number = connectedBottomLimitY - bounds.maxY;

  for (const hierarchyNode of realNodes) {
    const dataNode: PositionedNode = hierarchyNode.data.node as PositionedNode;
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

  const padding: Readonly<GraphPadding> = settings.padding;
  const innerWidth: number = Math.max(1, viewport.width - padding.left - padding.right);
  const innerHeight: number = Math.max(1, viewport.height - padding.top - padding.bottom);

  const columns: number = Math.max(1, settings.isolatedColumns);
  const usedColumns: number = Math.min(columns, nodes.length);

  const gridWidth: number = (usedColumns - 1) * settings.isolatedColumnGap;
  const startX: number = padding.left + (innerWidth - gridWidth) / 2;

  const startY: number = padding.top + innerHeight - isolatedArea.reservedHeight + settings.isolatedAreaGap;
  const sortedNodes: PositionedNode[] = [...nodes].sort((a: PositionedNode, b: PositionedNode): number => {
    return a.label.localeCompare(b.label);
  });

  sortedNodes.forEach((node: PositionedNode, index: number): void => {
    const columnIndex: number = index % columns;
    const rowIndex: number = Math.floor(index / columns);

    const xPosition: number = startX + columnIndex * settings.isolatedColumnGap;
    const yPosition: number = startY + rowIndex * settings.isolatedRowGap;

    setNodePosition(node, xPosition, yPosition);
  });
}

function computeDegrees(nodes: PositionedNode[], links: ResolvedLink[]): Map<string, number> {
  const degreesByNodeId: Map<string, number> = new Map<string, number>(
    nodes.map((node: PositionedNode): [string, number] => [node.id, 0]),
  );

  for (const link of links) {
    degreesByNodeId.set(link.source.id, (degreesByNodeId.get(link.source.id) ?? 0) + 1);
    degreesByNodeId.set(link.target.id, (degreesByNodeId.get(link.target.id) ?? 0) + 1);
  }

  return degreesByNodeId;
}

function buildHierarchy(nodes: PositionedNode[], links: ResolvedLink[]): d3.HierarchyNode<Hierarchy> {
  const nodesById: Map<string, PositionedNode> = new Map<string, PositionedNode>(
    nodes.map((node: PositionedNode): [string, PositionedNode] => [node.id, node]),
  );
  const childrenById: Map<string, string[]> = new Map<string, string[]>(
    nodes.map((node: PositionedNode): [string, string[]] => [node.id, []]),
  );
  const indegreeById: Map<string, number> = new Map<string, number>(
    nodes.map((node: PositionedNode): [string, number] => [node.id, 0]),
  );

  for (const link of links) {
    const sourceId: string = link.source.id;
    const targetId: string = link.target.id;

    if (!nodesById.has(sourceId) || !nodesById.has(targetId)) continue;
    childrenById.get(sourceId)?.push(targetId);
    indegreeById.set(targetId, (indegreeById.get(targetId) ?? 0) + 1);
  }

  const rootIds: string[] = [];
  for (const [nodeId, indegree] of indegreeById.entries()) {
    if (indegree === 0) rootIds.push(nodeId);
  }

  const sortedFallback: PositionedNode | undefined = [...nodes].sort((a: PositionedNode, b: PositionedNode): number => {
    return a.label.localeCompare(b.label);
  })[0];
  const visited: Set<string> = new Set<string>();

  const buildSubtree: (nodeId: string) => Hierarchy | null = (nodeId: string): Hierarchy | null => {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const node: PositionedNode | undefined = nodesById.get(nodeId);
    if (!node) return null;

    const childItems: Hierarchy[] = [];
    for (const childId of childrenById.get(nodeId) ?? []) {
      const childTree: Hierarchy | null = buildSubtree(childId);
      if (childTree) childItems.push(childTree);
    }

    return { id: nodeId, node, children: childItems.length ? childItems : undefined };
  };

  const forestChildren: Hierarchy[] = [];

  for (const rootId of rootIds) {
    const rootTree: Hierarchy | null = buildSubtree(rootId);
    if (rootTree) forestChildren.push(rootTree);
  }

  if (forestChildren.length === 0 && sortedFallback) {
    const rootTree: Hierarchy | null = buildSubtree(sortedFallback.id);
    if (rootTree) forestChildren.push(rootTree);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const remainderTree: Hierarchy | null = buildSubtree(node.id);
      if (remainderTree) forestChildren.push(remainderTree);
    }
  }

  const virtualRoot: Hierarchy = {
    id: '__virtual_root__',
    children: forestChildren.length ? forestChildren : undefined,
  };

  return d3.hierarchy<Hierarchy>(virtualRoot, (datum: Hierarchy) => datum.children);
}

function computeBounds(nodes: Array<d3.HierarchyPointNode<Hierarchy>>): Bounds {
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

  return { minX, maxX, minY, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}
