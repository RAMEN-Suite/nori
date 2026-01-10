import { PlatformAdapter } from './PlatformAdapter';
import { ElectronService } from '../../services/electron.service';
import { Manifest } from '../../models/Manifest';

export class ElectronAdapter implements PlatformAdapter {
  public readonly platform: 'electron' = 'electron' as const;
  public readonly hasFilesystem: boolean = true;

  private readonly electron: ElectronService;

  constructor(electron: ElectronService) {
    this.electron = electron;
  }

  public async chooseProjectLocation(): Promise<string | null> {
    return this.electron.showDirectory();
  }

  public async isProjectLocationValid(path: string): Promise<boolean> {
    return this.electron.isPathAccessible(path);
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
