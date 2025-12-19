import { Injectable } from '@angular/core';
import { APPLICATION_IPC } from '../../../../electron/src/static/IPC_EVENTS';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  public minimizeApplication(): void {
    window.electron?.send(APPLICATION_IPC.MINIMIZE_APPLICATION);
  }

  public maximizeApplication(): void {
    window.electron?.send(APPLICATION_IPC.MAXIMIZE_APPLICATION);
  }

  public closeApplication(): void {
    window.electron?.send(APPLICATION_IPC.CLOSE_APPLICATION);
  }

  public openExternalURL(url: string): void {
    window.electron?.send(APPLICATION_IPC.OPEN_EXTERNAL_URL, url);
  }
}
