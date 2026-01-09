import { Nullable } from '../../global';

export interface Manifest {
  manifestVersion: string;
  appVersion: string;

  projectId: string;
  name: string;
  description: string;
  metamodelId: string;

  createdAt: string;
  updatedAt: string;

  location: Nullable<string>;
}
