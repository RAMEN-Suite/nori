import { app } from 'electron';
import { Application } from './core/Application';
import { EventInitializer, Listener } from './core/EventInitializer';
import { ApplicationListener } from './core/listener/ApplicationListener';

const APPLICATION_TITLE: string = 'Context, Object and Ontology Kit';
if (require('electron-squirrel-startup')) app.quit();
const application: Application = new Application(APPLICATION_TITLE, app.isPackaged);

const listener: { new (app: Application): Listener }[] = [ApplicationListener];
const initializer: EventInitializer = new EventInitializer(listener, application);
initializer.init();
