import { app } from 'electron';
import path from 'path';

export const PROJECTS_PATH = path.join(app.getPath('userData'), 'projects');
export const PRELOAD_PATH = path.join(__dirname, '..', 'preload.js');
export const STATIC_PATH = path.join(__dirname, '..', '..', '..', 'json-editor', 'browser', 'index.html');
export const DEVELOPMENT_PATH = `http://localhost:4200`;
export const PRODUCTION_PATH = `file://${STATIC_PATH}`;
