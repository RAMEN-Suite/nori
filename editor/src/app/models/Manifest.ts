export interface Manifest {
  projectId: string;
  name: string;
  description: string;

  metamodelName: string;
  metamodelId: string;
  metamodelVersion: string;

  createdAt: string;
  updatedAt: string;

  manifestVersion: string;
  appVersion: string;
}
