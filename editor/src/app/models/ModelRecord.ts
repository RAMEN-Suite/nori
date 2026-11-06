import { type Model } from '@ramen-suite/core/model';

export type NodeColours = Record<string, string>;

export interface GraphView {
  positions: Record<string, { x: number; y: number }>;
  viewport: { x: number; y: number; scale: number };
}

export interface ViewSettings {
  graph?: GraphView;
  visibleNodeRefs?: string[];
  nodeColors: NodeColours;
}

export interface ModelRecord {
  projectId: string;
  modelId: string;

  name: string;
  levelIndex: number;
  gmodel: Model;

  view?: ViewSettings;

  createdAt: string;
  updatedAt: string;
  revision: number;
}
