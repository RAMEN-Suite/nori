import { GModel } from './GModel';

export interface Model {
  id: string;
  version: string;
  name: string;
  serialisation: GModel;
}
