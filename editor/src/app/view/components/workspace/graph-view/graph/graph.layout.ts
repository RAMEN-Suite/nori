import { RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import type { GraphData, GraphLink, GraphNode } from './model-graph';
import type { GraphView } from '../../../../../models/ModelRecord';
import {
  GRAPH_NODE_WIDTH,
  GRAPH_NODE_HEIGHT,
  type GraphInputModel,
  type GraphLayoutSettings,
  type GraphPadding,
  type PositionedNode,
  type RenderModel,
  type ResolvedLink,
  type ViewportSize,
} from './graph.types';

type VisibilityResult = Readonly<{ nodes: PositionedNode[]; links: ResolvedLink[] }>;

export function buildRenderModel(input: GraphInputModel): RenderModel {
  const baseNodes: PositionedNode[] = createNodes(input.data);
  const nodesById: Map<string, PositionedNode> = new Map<string, PositionedNode>(
    baseNodes.map((node: PositionedNode): [string, PositionedNode] => [node.id, node]),
  );

  const baseLinks: ResolvedLink[] = createLinks(input.data, nodesById);
  assignLinkLanes(baseLinks);
  const counts: Map<string, number> = new Map();
  for (const link of baseLinks) {
    if (link.source !== link.target) continue;
    link.loopIndex = counts.get(link.source.id) ?? 0;
    counts.set(link.source.id, link.loopIndex + 1);
  }

  const visible: VisibilityResult = applyVisibility(baseNodes, baseLinks, input.settings);
  if (placeRamenNodes(visible.nodes)) orientRamenLoops(visible.links);
  else placeNodes(visible.nodes, [], input.viewport, input.settings.padding);

  return { nodes: visible.nodes, links: visible.links, nodesById };
}

export function placeRamenNodes(nodes: readonly PositionedNode[]): boolean {
  const positions: Readonly<Record<string, Point>> = {
    [RAMEN_ELEMENT.COLLECTION]: { x: 0, y: -260 },
    [RAMEN_ELEMENT.ENTITY]: { x: 0, y: 260 },
    [RAMEN_ELEMENT.CONTENT]: { x: -380, y: 0 },
    [RAMEN_ELEMENT.ANNOTATION]: { x: 0, y: 0 },
  };
  if (nodes.length !== 4 || nodes.some((node: PositionedNode): boolean => !positions[node.id])) return false;
  for (const node of nodes) {
    const position: Point | undefined = positions[node.id];
    if (position) setNodePosition(node, position.x, position.y);
  }
  return true;
}

function orientRamenLoops(links: readonly ResolvedLink[]): void {
  const sides: Readonly<Record<string, ResolvedLink['loopSide']>> = {
    [RAMEN_ELEMENT.COLLECTION]: 'top',
    [RAMEN_ELEMENT.CONTENT]: 'left',
    [RAMEN_ELEMENT.ANNOTATION]: 'right',
    [RAMEN_ELEMENT.ENTITY]: 'bottom',
  };
  for (const link of links) {
    if (link.source === link.target) link.loopSide = sides[link.source.id];
  }
}

function assignLinkLanes(links: ResolvedLink[]): void {
  const groups: Map<string, ResolvedLink[]> = new Map();
  for (const link of links) {
    if (link.source === link.target) continue;
    const key: string = JSON.stringify([link.source.id, link.target.id].sort());
    const group: ResolvedLink[] = groups.get(key) ?? [];
    group.push(link);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.forEach((link: ResolvedLink, index: number): void => {
      const direction: number = link.source.id < link.target.id ? 1 : -1;
      link.curveOffset = (index - (group.length - 1) / 2) * 88 * direction;
    });
  }
}

export function getViewportSize(hostElement: HTMLDivElement): ViewportSize {
  return { width: hostElement.clientWidth || 800, height: hostElement.clientHeight || 500 };
}

export function setNodePosition(node: PositionedNode, x: number, y: number): void {
  node.x = x;
  node.y = y;
}

function createNodes(data: GraphData): PositionedNode[] {
  return data.nodes.map((node: GraphNode): PositionedNode => ({ ...node, x: 0, y: 0 }));
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

function applyVisibility(nodes: PositionedNode[], links: ResolvedLink[], settings: GraphLayoutSettings): VisibilityResult {
  if (!settings.areIsolatedNodesHidden) return { nodes, links };

  const connected: Set<string> = new Set(links.flatMap((link: ResolvedLink): string[] => [link.source.id, link.target.id]));
  return { nodes: nodes.filter((node: PositionedNode): boolean => connected.has(node.id)), links };
}

type PlacementBounds = Readonly<{ left: number; right: number; top: number; bottom: number }>;
type Point = Readonly<{ x: number; y: number }>;

export function placeNodes(
  nodes: readonly PositionedNode[],
  retained: readonly PositionedNode[],
  viewport: ViewportSize,
  padding: GraphPadding,
  transform: Readonly<{ x: number; y: number; k: number }> = { x: 0, y: 0, k: 1 },
): boolean {
  const horizontal: GraphPadding = viewport.width > 720 ? padding : { ...padding, left: 24, right: 24 };
  const bounds: PlacementBounds = {
    left: (horizontal.left - transform.x) / transform.k + GRAPH_NODE_WIDTH / 2,
    right: (viewport.width - horizontal.right - transform.x) / transform.k - GRAPH_NODE_WIDTH / 2,
    top: (padding.top - transform.y) / transform.k + GRAPH_NODE_HEIGHT / 2,
    bottom: (viewport.height - padding.bottom - transform.y) / transform.k - GRAPH_NODE_HEIGHT / 2,
  };
  const occupied: PositionedNode[] = [...retained];
  let needsFit: boolean = false;
  for (const node of nodes) {
    const position: Point = findFreePosition(occupied, bounds);
    needsFit ||= position.x < bounds.left || position.x > bounds.right || position.y < bounds.top || position.y > bounds.bottom;
    setNodePosition(node, position.x, position.y);
    occupied.push(node);
  }
  return needsFit;
}

function findFreePosition(occupied: readonly PositionedNode[], bounds: PlacementBounds): Point {
  const centre: Point = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  for (let attempt: number = 0; attempt < 100; attempt++) {
    const spread: number = attempt < 60 ? 0.65 : 1;
    const x: number = centre.x + (Math.random() - 0.5) * Math.max(0, bounds.right - bounds.left) * spread;
    const y: number = centre.y + (Math.random() - 0.5) * Math.max(0, bounds.bottom - bounds.top) * spread;
    if (!occupied.some((node: PositionedNode): boolean => overlaps(node, x, y))) return { x, y };
  }
  for (let y: number = bounds.top; y <= bounds.bottom; y += 104) {
    for (let x: number = bounds.left; x <= bounds.right; x += 192) {
      if (!occupied.some((node: PositionedNode): boolean => overlaps(node, x, y))) return { x, y };
    }
  }
  return findSpaceAroundCentre(occupied, centre);
}

function findSpaceAroundCentre(occupied: readonly PositionedNode[], centre: Point): Point {
  for (let ring: number = 1; ; ring++) {
    for (let step: number = -ring; step <= ring; step++) {
      for (const side of [-1, 1]) {
        const candidates: Point[] = [
          { x: centre.x + step * 192, y: centre.y + side * ring * 104 },
          { x: centre.x + side * ring * 192, y: centre.y + step * 104 },
        ];
        const free: Point | undefined = candidates.find(
          (point: Point): boolean => !occupied.some((node: PositionedNode): boolean => overlaps(node, point.x, point.y)),
        );
        if (free) return free;
      }
    }
  }
}

function overlaps(node: PositionedNode, x: number, y: number): boolean {
  return Math.abs(node.x - x) < 192 && Math.abs(node.y - y) < 104;
}

export function getFitViewport(
  viewport: ViewportSize,
  padding: GraphPadding,
  bounds: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>,
  maxScale: number = 1.25,
): GraphView['viewport'] | null {
  if (bounds.width <= 0 || bounds.height <= 0) return null;

  const horizontal: GraphPadding = viewport.width > 720 ? padding : { ...padding, left: 24, right: 24 };
  const width: number = Math.max(1, viewport.width - horizontal.left - horizontal.right);
  const height: number = Math.max(1, viewport.height - padding.top - padding.bottom);
  const scale: number = Math.max(0.2, Math.min(maxScale, (width - 32) / bounds.width, (height - 32) / bounds.height));

  return {
    x: horizontal.left + (width - bounds.width * scale) / 2 - bounds.x * scale,
    y: padding.top + (height - bounds.height * scale) / 2 - bounds.y * scale,
    scale,
  };
}
