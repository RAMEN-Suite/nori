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

export type CreateManifest = Pick<Manifest, 'name' | 'description' | 'metamodelName' | 'metamodelId' | 'metamodelVersion'>;
export type UpdateManifest = Pick<Manifest, 'name' | 'description'>;
