import { app, BrowserWindow, screen } from 'electron';
import { DEVELOPMENT_PATH, PRELOAD_PATH, STATIC_PATH } from '../static/PATHS';

/** Owns the desktop window and the Electron application lifecycle. */
export class Application {
  private readonly title: string;
  private readonly isProduction: boolean;
  private window: BrowserWindow | null = null;

  public constructor(title: string, isProduction: boolean) {
    this.title = title;
    this.isProduction = isProduction;
    void app
      .whenReady()
      .then((): void => this.createWindow())
      .catch((error: unknown): void => {
        console.error('Could not start Nori:', error);
        app.quit();
      });
    app.on('window-all-closed', (): void => {
      if (process.platform !== 'darwin') app.quit();
    });
    app.on('activate', (): void => {
      if (BrowserWindow.getAllWindows().length === 0) this.createWindow();
    });
  }

  public getWindow(): BrowserWindow | null {
    return this.window;
  }

  private createWindow(): void {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const window: BrowserWindow = new BrowserWindow({
      width: Math.floor(width * 0.9),
      height: Math.floor(height * 0.9),
      minWidth: Math.min(1280, width),
      minHeight: Math.min(720, height),
      title: this.title,
      center: true,
      autoHideMenuBar: true,
      titleBarStyle: 'hiddenInset',
      webPreferences: { preload: PRELOAD_PATH, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    this.window = window;
    window.on('closed', (): void => {
      this.window = null;
    });
    window.webContents.setWindowOpenHandler((): { action: 'deny' } => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event: Electron.Event, url: string): void => {
      if (url !== window.webContents.getURL()) event.preventDefault();
    });

    const loaded: Promise<void> = this.isProduction ? window.loadFile(STATIC_PATH) : window.loadURL(DEVELOPMENT_PATH);
    void loaded.catch((error: unknown): void => console.error('Could not load Nori:', error));
  }
}
