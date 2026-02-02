import { GModel } from '../core/models/GModel';

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
