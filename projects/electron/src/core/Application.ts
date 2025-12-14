import { app, BrowserWindow, dialog, screen } from 'electron';
import { ERROR_MSG } from '../static/ERROR_MSG';
import { DEVELOPMENT_PATH, PRELOAD_PATH, PRODUCTION_PATH, PROJECTS_PATH } from '../static/PATHS';
import fs from 'fs';

export class Application {
  protected title: string = '';
  protected window: BrowserWindow;

  protected isProduction: boolean;

  constructor(title: string, isProduction: boolean) {
    this.title = title;
    this.isProduction = isProduction;
    this.init();
  }

  public getWindow(): BrowserWindow {
    return this.window;
  }

  public init(): void {
    this.initProjectFolder();
    this.initAppListener();
  }

  protected initProjectFolder(): void {
    try {
      if (!fs.existsSync(PROJECTS_PATH)) {
        fs.mkdirSync(PROJECTS_PATH);
      }
    } catch (error) {
      dialog.showErrorBox(ERROR_MSG.PROJECT_INIT.TITLE, ERROR_MSG.PROJECT_INIT.MSG);
      app.quit();
    }
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
      frame: false,
      height: screenHeight,
      width: screenWidth,
      minWidth: Math.min(1024, screenWidth),
      minHeight: Math.min(576, screenHeight),
      useContentSize: true,
      center: true,
      autoHideMenuBar: true,
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
