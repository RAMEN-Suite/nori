import { Listener, ListenerFn } from '../EventInitializer';
import { APPLICATION_IPC } from '../../static/IPC_EVENTS';
import { app, BrowserWindow, dialog, IpcMainEvent, shell } from 'electron';
import { Nullable } from '../../global';
import fs from 'fs';

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
    [APPLICATION_IPC.APPLICATION_SHOW_DIRECTORY]: {
      type: 'handle',
      fn: this.handleShowDialog,
    },
    [APPLICATION_IPC.APPLICATION_ACCESS_PATH]: {
      type: 'handle',
      fn: this.handleIsPathAccessible,
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

  protected handleShowDialog(_: IpcMainEvent, title: string): string {
    const filePaths: Nullable<string[]> = dialog.showOpenDialogSync(this.application.getWindow(), {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: app.getPath('documents'),
      title,
    });

    if (!filePaths) return '';
    else return filePaths[0];
  }

  protected async handleIsPathAccessible(_: IpcMainEvent, path: string): Promise<boolean> {
    try {
      await fs.promises.access(path);
      return true;
    } catch (error: unknown) {
      return false;
    }
  }
}
