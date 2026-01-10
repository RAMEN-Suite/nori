import { Manifest } from '../../models/Manifest';

export interface PlatformAdapter {
  readonly platform: 'browser' | 'electron';
  readonly hasFilesystem: boolean;

  chooseProjectLocation(): Promise<string | null>;
  isProjectLocationValid(path: string): Promise<boolean>;

  saveManifest(manifest: Manifest): Promise<void>;
  loadManifest(manifest: Manifest): Promise<Manifest>;
}
