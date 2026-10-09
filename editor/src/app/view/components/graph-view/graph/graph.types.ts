import type { D3ZoomEvent, DragBehavior, Selection, ZoomBehavior } from 'd3';
import type { GraphData, GraphLink, GraphNode } from '../../../../core/utils/ModelGraph';

export type GraphPadding = Readonly<{ top: number; right: number; bottom: number; left: number }>;

export type GraphLayoutSettings = Readonly<{
  padding: GraphPadding;
  areIsolatedNodesHidden: boolean;
}>;

export const DEFAULT_GRAPH_PADDING: GraphPadding = { top: 20, right: 40, bottom: 20, left: 40 };
export const DEFAULT_GRAPH_LAYOUT_SETTINGS: GraphLayoutSettings = {
  padding: DEFAULT_GRAPH_PADDING,
  areIsolatedNodesHidden: false,
};

export type PositionedNode = GraphNode & {
  x: number;
  y: number;
};

export type ResolvedLink = Omit<GraphLink, 'source' | 'target'> & {
  source: PositionedNode;
  target: PositionedNode;
  loopIndex?: number;
  loopSide?: 'top' | 'right' | 'bottom' | 'left';
  curveOffset?: number;
};

export type RenderModel = Readonly<{
  nodes: PositionedNode[];
  links: ResolvedLink[];
  nodesById: ReadonlyMap<string, PositionedNode>;
}>;

export type ViewportSize = Readonly<{ width: number; height: number }>;
export type GraphInputModel = Readonly<{ data: GraphData; settings: GraphLayoutSettings; viewport: ViewportSize }>;

export type SVGSelection = Selection<SVGSVGElement, unknown, null, undefined>;
export type RootSelection = Selection<SVGGElement, unknown, null, undefined>;

export type NodeSelection = Selection<SVGGElement, PositionedNode, SVGGElement, unknown>;
export type LinkSelection = Selection<SVGPathElement, ResolvedLink, SVGGElement, unknown>;

export type ZoomBehaviour = ZoomBehavior<SVGSVGElement, unknown>;
export type ZoomEvent = D3ZoomEvent<SVGSVGElement, unknown>;

export type NodeDrag = DragBehavior<SVGGElement, PositionedNode, unknown>;
