import path from 'path';

export const ROOT_PATH: string = path.join(__dirname, '..');
export const PRELOAD_PATH: string = path.join(ROOT_PATH, 'preload.js');
export const STATIC_PATH: string = path.join(ROOT_PATH, '..', 'editor', 'browser', 'index.html');

export const DEVELOPMENT_PATH: string = `http://localhost:4200`;
export const PRODUCTION_PATH: string = `file://${STATIC_PATH}`;
