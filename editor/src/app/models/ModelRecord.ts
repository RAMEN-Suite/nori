import { GModel } from '@ramen-suite/core/gcore';

export type NodeColors = Record<string, string>;

export interface ViewSettings {
  nodeColors: NodeColors;
}

export interface ModelRecord {
  projectId: string;
  modelId: string;

  name: string;
  slot: number;
  gmodel: GModel;

  view?: ViewSettings;

  createdAt: string;
  updatedAt: string;
  revision: number;
}
