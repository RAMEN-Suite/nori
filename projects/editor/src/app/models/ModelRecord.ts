import { GModel } from '../core/models/GModel';

export type NodeColors = Record<string, string>;

export interface ViewSettings {
  nodeColors: NodeColors;
}

export interface ModelRecord {
  projectId: string;
  modelId: string;

  gmodel: GModel;
  slot: number;

  name: string;
  description: string;
  view?: ViewSettings;

  createdAt: string;
  updatedAt: string;
  revision: number;
}
