import { Listener, ListenerFn } from '../EventInitializer';
import { APPLICATION_IPC } from '../../static/IPC_EVENTS';
import { app, BrowserWindow, IpcMainEvent, shell } from 'electron';

export class ApplicationListener extends Listener {
  protected listener: ListenerFn = {
    [APPLICATION_IPC.APPLICATION_CLOSE]: {
      type: 'on',
      fn: this.handleCloseApplication,
    },
    [APPLICATION_IPC.APPLICATION_MINIMIZE]: {
      type: 'on',
      fn: this.handleMinimizeApplicationWindow,
    },
    [APPLICATION_IPC.APPLICATION_MAXIMIZE]: {
      type: 'on',
      fn: this.handleMaximizeApplicationWindow,
    },
    [APPLICATION_IPC.APPLICATION_OPEN_URL]: {
      type: 'on',
      fn: this.handleOpenExternalURL,
    },
  };

  protected handleCloseApplication(): void {
    app.quit();
  }

  protected handleMinimizeApplicationWindow(): void {
    const window: BrowserWindow = this.application.getWindow();
    if (window.isMinimized()) window.restore();
    else window.minimize();
  }

  protected handleMaximizeApplicationWindow(): void {
    const window: BrowserWindow = this.application.getWindow();
    if (window.isMaximized()) window.restore();
    else window.maximize();
  }

  protected async handleOpenExternalURL(_: IpcMainEvent, url: string): Promise<void> {
    await shell.openExternal(url);
  }
}
