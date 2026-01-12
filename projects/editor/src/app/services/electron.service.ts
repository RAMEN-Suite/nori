import { Injectable } from '@angular/core';
import { APPLICATION_IPC } from '../../../../electron/src/static/IPC_EVENTS';
import { Electron } from '../../electron';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private readonly electronAPI: Electron = window.electron!;

  private send(event: string, payload?: unknown): void {
    this.electronAPI.send(event, payload);
  }

  private async invoke<T>(event: string, payload?: unknown): Promise<T> {
    return this.electronAPI.invoke(event, payload);
  }

  public minimizeApplication(): void {
    this.send(APPLICATION_IPC.APPLICATION_MINIMIZE);
  }

  public maximizeApplication(): void {
    this.send(APPLICATION_IPC.APPLICATION_MAXIMIZE);
  }

  public closeApplication(): void {
    this.send(APPLICATION_IPC.APPLICATION_CLOSE);
  }
}
