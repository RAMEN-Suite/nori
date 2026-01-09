import { Injectable } from '@angular/core';
import { APPLICATION_IPC } from '../../../../electron/src/static/IPC_EVENTS';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  public minimizeApplication(): void {
    window.electron?.send(APPLICATION_IPC.APPLICATION_MINIMIZE);
  }

  public maximizeApplication(): void {
    window.electron?.send(APPLICATION_IPC.APPLICATION_MAXIMIZE);
  }

  public closeApplication(): void {
    window.electron?.send(APPLICATION_IPC.APPLICATION_CLOSE);
  }

  public openExternalURL(url: string): void {
    window.electron?.send(APPLICATION_IPC.APPLICATION_OPEN_URL, url);
  }

  public async openDirectory(): Promise<string> {
    if (!window.electron) return '';
    return window.electron?.invoke(APPLICATION_IPC.APPLICATION_OPEN_DIRECTORY);
  }

  public async accessLocation(path: string): Promise<boolean> {
    if (!window.electron) return false;
    return window.electron.invoke(APPLICATION_IPC.APPLICATION_ACCESS_PATH, path);
  }
}
