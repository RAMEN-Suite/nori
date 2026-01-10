import { Injectable } from '@angular/core';
import { APPLICATION_IPC } from '../../../../electron/src/static/IPC_EVENTS';
import { Electron } from '../../electron';
import { Nullable } from '../../global';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private readonly electronAPI: Nullable<Electron> = window.electron;
  public readonly isAvailable: boolean = this.electronAPI !== undefined;

  private send(event: string, ...args: unknown[]): void {
    this.electronAPI?.send(event, ...args);
  }

  private async invoke<T>(event: string, fallback: T, ...args: unknown[]): Promise<T> {
    if (!this.electronAPI) return fallback;
    return this.electronAPI?.invoke(event, ...args);
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

  public openExternalURL(url: string): void {
    this.send(APPLICATION_IPC.APPLICATION_OPEN_URL, url);
  }

  public async showDirectory(): Promise<string> {
    const defaultValue: string = '';
    return this.invoke(APPLICATION_IPC.APPLICATION_SHOW_DIRECTORY, defaultValue);
  }

  public async isPathAccessible(path: string): Promise<boolean> {
    const defaultValue: boolean = false;
    return this.invoke(APPLICATION_IPC.APPLICATION_ACCESS_PATH, defaultValue, path);
  }
}
