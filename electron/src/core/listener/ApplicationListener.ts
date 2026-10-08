import { app, ipcMain, shell, type IpcMainEvent, type IpcMainInvokeEvent, type BrowserWindow } from 'electron';
import { type Application } from '../Application';
import { APPLICATION_IPC } from '../../static/IPC_EVENTS';

/** Handles the four desktop actions exposed by the preload bridge. */
export class ApplicationListener {
  private readonly application: Application;

  public constructor(application: Application) {
    this.application = application;
  }

  public listen(): void {
    ipcMain.on(APPLICATION_IPC.APPLICATION_CLOSE, (event: IpcMainEvent): void => {
      if (this.isEditor(event)) app.quit();
    });
    ipcMain.on(APPLICATION_IPC.APPLICATION_MINIMIZE, (event: IpcMainEvent): void => {
      if (this.isEditor(event)) this.application.getWindow()?.minimize();
    });
    ipcMain.on(APPLICATION_IPC.APPLICATION_MAXIMIZE, (event: IpcMainEvent): void => {
      const window: BrowserWindow | null = this.application.getWindow();
      if (!window || !this.isEditor(event)) return;
      if (window.isMaximized()) window.unmaximize();
      else window.maximize();
    });
    ipcMain.handle(APPLICATION_IPC.APPLICATION_OPEN_URL, async (event: IpcMainInvokeEvent, url: unknown): Promise<void> => {
      if (!this.isEditor(event)) throw new Error('Unknown desktop sender.');
      if (typeof url !== 'string' || !URL.canParse(url)) throw new Error('Invalid external URL.');
      const parsed: URL = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Only web links can be opened.');
      await shell.openExternal(parsed.href);
    });
  }

  private isEditor(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
    const window: BrowserWindow | null = this.application.getWindow();
    return !!window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
  }
}
