import { GraphData, GraphLink, GraphNode } from '../../../../../core/GModelGraph';
import { D3ZoomEvent, DragBehavior, Selection, ZoomBehavior } from 'd3';

export type GraphPadding = Readonly<{ top: number; right: number; bottom: number; left: number }>;

export type GraphLayoutMode = 'treeTopDown' | 'clusterTopDown';

export type GraphLayoutSettings = Readonly<{
  layoutMode: GraphLayoutMode;
  padding: GraphPadding;

  areIsolatedNodesHidden: boolean;

  nodeRadius: number;
  layerGap: number;
  nodeSeparation: number;

  isolatedColumns: number;
  isolatedRowGap: number;
  isolatedColumnGap: number;
  isolatedAreaGap: number;
}>;

export const DEFAULT_GRAPH_PADDING: GraphPadding = { top: 50, right: 40, bottom: 30, left: 40 };

export const DEFAULT_GRAPH_LAYOUT_SETTINGS: GraphLayoutSettings = {
  layoutMode: 'clusterTopDown',
  padding: DEFAULT_GRAPH_PADDING,

  areIsolatedNodesHidden: false,

  nodeRadius: 15,
  layerGap: 70,
  nodeSeparation: 60,

  isolatedColumns: 4,
  isolatedRowGap: 80,
  isolatedColumnGap: 120,
  isolatedAreaGap: 100,
};

export type PositionedNode = GraphNode & { x: number; y: number; baseX: number; baseY: number };

export type ResolvedLink = Omit<GraphLink, 'source' | 'target'> & { source: PositionedNode; target: PositionedNode };

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
