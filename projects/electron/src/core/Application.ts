import { app, BrowserWindow, screen } from 'electron';
import { DEVELOPMENT_PATH, PRELOAD_PATH, PRODUCTION_PATH } from '../static/PATHS';
import * as process from 'node:process';

export class Application {
  protected readonly title: string = '';
  protected readonly isProduction: boolean;
  protected window: BrowserWindow;

  constructor(title: string, isProduction: boolean) {
    this.title = title;
    this.isProduction = isProduction;
    this.init();
  }

  public getWindow(): BrowserWindow {
    return this.window;
  }

  public init(): void {
    this.initAppListener();
  }

  protected initAppListener(): void {
    app.on('ready', () => this.createWindow());

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  protected createWindow(): void {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const screenWidth: number = Math.floor(width * 0.9);
    const screenHeight: number = Math.floor(height * 0.9);

    this.window = new BrowserWindow({
      height: screenHeight,
      width: screenWidth,
      minWidth: Math.min(1024, screenWidth),
      minHeight: Math.min(576, screenHeight),
      useContentSize: true,
      center: true,
      autoHideMenuBar: true,
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        preload: PRELOAD_PATH,
        webSecurity: this.isProduction,
      },
    });

    if (this.isProduction) {
      this.window.setMenu(null);
    }

    const url: string = this.isProduction ? PRODUCTION_PATH : DEVELOPMENT_PATH;
    this.window.loadURL(url);
  }
}
