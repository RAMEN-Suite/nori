import { Listener, ListenerMap } from '../EventInitializer';
import { Application } from '../Application';
import { APPLICATION_IPC } from '../../../../shared/static/IPC_EVENTS';
import { app, BrowserWindow, IpcMainEvent, shell } from 'electron';

export class ApplicationListener extends Listener {
  protected application: Application;
  protected listener: ListenerMap = {
    [APPLICATION_IPC.GET_APP_VERSION]: {
      type: 'handle',
      fn: this.handleGetAppVersion,
    },
    [APPLICATION_IPC.CLOSE_APPLICATION]: {
      type: 'on',
      fn: this.handleCloseApplication,
    },
    [APPLICATION_IPC.MINIMIZE_APPLICATION]: {
      type: 'on',
      fn: this.handleMinimizeApplicationWindow,
    },
    [APPLICATION_IPC.MAXIMIZE_APPLICATION]: {
      type: 'on',
      fn: this.handleMaximizeApplicationWindow,
    },
    [APPLICATION_IPC.OPEN_EXTERNAL_URL]: {
      type: 'on',
      fn: this.handleOpenExternalURL,
    },
  };

  constructor(application: Application) {
    super();
    this.application = application;
  }

  protected handleGetAppVersion(): string {
    return app.getVersion();
  }

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
