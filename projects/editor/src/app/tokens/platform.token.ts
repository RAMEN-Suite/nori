import { InjectionToken } from '@angular/core';
import { PlatformAdapter } from '../adapter/platforms/PlatformAdapter';
import { ElectronAdapter } from '../adapter/platforms/electron.adapter';
import { BrowserAdapter } from '../adapter/platforms/browser.adapter';
import { ElectronService } from '../services/electron.service';

export const PLATFORM = new InjectionToken<PlatformAdapter>('PLATFORM');

export function platformFactory(electron: ElectronService): PlatformAdapter {
  return electron.isAvailable ? new ElectronAdapter(electron) : new BrowserAdapter();
}
