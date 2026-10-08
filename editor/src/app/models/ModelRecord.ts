import { Model } from '@ramen-suite/core/model';

export type NodeColors = Record<string, string>;

export interface ViewSettings {
  nodeColors: NodeColors;
}

export interface ModelRecord {
  projectId: string;
  modelId: string;

  name: string;
  slot: number;
  gmodel: Model;

  view?: ViewSettings;

  createdAt: string;
  updatedAt: string;
  revision: number;
}
