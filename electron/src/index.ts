import { app } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { Application } from './core/Application';
import { ApplicationListener } from './core/listener/ApplicationListener';

if (squirrelStartup) app.quit();
else {
  app.setName('Nori');
  if (process.platform === 'win32') app.setAppUserModelId('com.squirrel.Nori.Nori');
  const application: Application = new Application('Nori', app.isPackaged);
  const listener: ApplicationListener = new ApplicationListener(application);
  listener.listen();
}
