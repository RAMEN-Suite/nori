import { contextBridge, ipcRenderer } from 'electron';
import { APPLICATION_IPC } from './static/IPC_EVENTS';

contextBridge.exposeInMainWorld('platform', process.platform);
contextBridge.exposeInMainWorld('electron', {
  minimise: (): void => ipcRenderer.send(APPLICATION_IPC.APPLICATION_MINIMIZE),
  maximise: (): void => ipcRenderer.send(APPLICATION_IPC.APPLICATION_MAXIMIZE),
  close: (): void => ipcRenderer.send(APPLICATION_IPC.APPLICATION_CLOSE),
  openExternal: async (url: string): Promise<void> => {
    await ipcRenderer.invoke(APPLICATION_IPC.APPLICATION_OPEN_URL, url);
  },
});
