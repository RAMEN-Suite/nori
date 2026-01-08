export interface IManifest {
  projectId: string;
  name: string;
  description: string;

  createdAt: string;
  updatedAt: string;
  location?: string;

  metamodelRef: string;
  appVersion: string;
  schemaVersion: string;
}
