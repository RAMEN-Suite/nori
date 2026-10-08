import { app } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { Application } from './core/Application';
import { ApplicationListener } from './core/listener/ApplicationListener';

if (squirrelStartup) app.quit();
else {
  const application: Application = new Application('Nori', app.isPackaged);
  const listener: ApplicationListener = new ApplicationListener(application);
  listener.listen();
}
