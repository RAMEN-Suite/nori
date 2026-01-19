import { GraphData, GraphLink, GraphNode } from '../../../../core/GModelGraph';

export type NodeColorMap = Readonly<Record<string, string>>;

export type GraphPadding = Readonly<{
  top: number;
  right: number;
  bottom: number;
  left: number;
}>;

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

export const DEFAULT_GRAPH_PADDING: GraphPadding = {
  top: 50,
  right: 40,
  bottom: 30,
  left: 40,
};

export const DEFAULT_GRAPH_LAYOUT_SETTINGS: GraphLayoutSettings = {
  layoutMode: 'clusterTopDown',
  padding: DEFAULT_GRAPH_PADDING,

  areIsolatedNodesHidden: true,

  nodeRadius: 15,
  layerGap: 70,
  nodeSeparation: 60,

  isolatedColumns: 3,
  isolatedRowGap: 80,
  isolatedColumnGap: 120,
  isolatedAreaGap: 80,
};

export type PositionedNode = GraphNode & {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  wobbleUntil?: number;
};

export type ResolvedLink = Omit<GraphLink, 'source' | 'target'> & {
  source: PositionedNode;
  target: PositionedNode;
};

export type RenderModel = Readonly<{
  nodes: PositionedNode[];
  links: ResolvedLink[];
  nodesById: Map<string, PositionedNode>;
}>;

export type ViewportSize = Readonly<{ width: number; height: number }>;

export type GraphInputModel = Readonly<{
  data: GraphData;
  settings: GraphLayoutSettings;
  viewport: ViewportSize;
}>;
