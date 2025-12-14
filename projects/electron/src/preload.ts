import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  send: (channel: string, data: any): void => {
    ipcRenderer.send(channel, data);
  },
  sendSync: (channel: string, data: any): any => {
    return ipcRenderer.sendSync(channel, data);
  },

  on: (channel: string, func: (...args: any[]) => void): void => {
    const newFunc = (...args: any[]): void => func(...args);
    ipcRenderer.on(channel, newFunc);
  },
  invoke: (channel: string, data: any): Promise<any> => {
    return ipcRenderer.invoke(channel, data);
  },

  removeListener: (channel: string, func: (...args: any[]) => void): void => {
    ipcRenderer.removeListener(channel, func);
  },
});
