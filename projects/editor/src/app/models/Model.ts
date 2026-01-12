import { GModel } from './GModel';

export interface Model {
  projectId: string;
  modelId: string;

  gmodel: GModel;
  slot: number;

  name: string;
  description: string;

  createdAt: string;
  updatedAt: string;
  revision: number;
}
