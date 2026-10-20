import path from 'path';

export const ROOT_PATH: string = path.join(__dirname, '..');
export const ICON_PATH: string = path.join(
  ROOT_PATH,
  '..',
  '..',
  'icons',
  process.platform === 'darwin' ? 'icon-mac.png' : 'icon.png',
);
export const PRELOAD_PATH: string = path.join(ROOT_PATH, 'preload.js');
export const STATIC_PATH: string = path.join(ROOT_PATH, '..', 'editor', 'browser', 'index.html');

export const DEVELOPMENT_PATH: string = 'http://localhost:4200';
