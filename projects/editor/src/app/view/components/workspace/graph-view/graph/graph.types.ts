import { GraphData, GraphLink, GraphNode } from '../../../../../core/utils/GModelGraph';
import { D3ZoomEvent, DragBehavior, Selection, ZoomBehavior } from 'd3';

export type GraphPadding = Readonly<{ top: number; right: number; bottom: number; left: number }>;
export type GraphLayout = 'treeTopDown' | 'clusterTopDown';

export type GraphLayoutSettings = Readonly<{
  layout: GraphLayout;
  padding: GraphPadding;

  nodeRadius: number;
  nodeSeparation: number;
  layerGap: number;

  areIsolatedNodesHidden: boolean;
  isolatedColumns: number;
  isolatedRowGap: number;
  isolatedColumnGap: number;
  isolatedAreaGap: number;
}>;

export const DEFAULT_GRAPH_PADDING: GraphPadding = { top: 20, right: 40, bottom: 20, left: 40 };
export const DEFAULT_GRAPH_LAYOUT_SETTINGS: GraphLayoutSettings = {
  layout: 'clusterTopDown',
  padding: DEFAULT_GRAPH_PADDING,

  nodeRadius: 15,
  nodeSeparation: 60,
  layerGap: 70,

  areIsolatedNodesHidden: false,
  isolatedColumns: 5,
  isolatedRowGap: 80,
  isolatedColumnGap: 80,
  isolatedAreaGap: 100,
};

export type GhostNodeMeta = Readonly<{
  kind: 'ghost';
  realNodeId: string;
  selfLinkId: string;
}>;
export type PositionedNode = GraphNode & {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  ghost?: GhostNodeMeta;
};

export type ResolvedLinkMeta = Readonly<{ kind: 'ghost-self' }>;
export type ResolvedLink = Omit<GraphLink, 'source' | 'target'> & {
  source: PositionedNode;
  target: PositionedNode;
  meta?: ResolvedLinkMeta;
};

export type RenderModel = Readonly<{
  nodes: PositionedNode[];
  links: ResolvedLink[];
  nodesById: ReadonlyMap<string, PositionedNode>;
}>;

export type ViewportSize = Readonly<{ width: number; height: number }>;
export type GraphInputModel = Readonly<{ data: GraphData; settings: GraphLayoutSettings; viewport: ViewportSize }>;

// graph.component - d3 type definition outsourcing

export type SVGSelection = Selection<SVGSVGElement, unknown, null, undefined>;
export type RootSelection = Selection<SVGGElement, unknown, null, undefined>;

export type NodeSelection = Selection<SVGGElement, PositionedNode, SVGGElement, unknown>;
export type LinkSelection = Selection<SVGLineElement, ResolvedLink, SVGGElement, unknown>;

export type ZoomBehaviour = ZoomBehavior<SVGSVGElement, unknown>;
export type ZoomEvent = D3ZoomEvent<SVGSVGElement, unknown>;

export type NodeDrag = DragBehavior<SVGGElement, PositionedNode, unknown>;
