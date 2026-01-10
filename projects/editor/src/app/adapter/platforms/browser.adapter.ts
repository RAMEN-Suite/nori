import { PlatformAdapter } from './PlatformAdapter';
import { Manifest } from '../../models/Manifest';

export class BrowserAdapter implements PlatformAdapter {
  public readonly platform: 'browser' = 'browser' as const;
  public readonly hasFilesystem: boolean = false;

  public async chooseProjectLocation(): Promise<string | null> {
    return null;
  }

  public async isProjectLocationValid(): Promise<boolean> {
    return true;
  }

  public async saveManifest(manifest: Manifest): Promise<void> {
    // todo
    return;
  }

  public async loadManifest(manifest: Manifest): Promise<Manifest> {
    // todo
    return {} as Manifest;
  }
}
