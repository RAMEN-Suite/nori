declare global {
  interface Window {
    electron: IElectron;
  }
}

export interface IElectron {
  on: (channel: string, func: (...args: any[]) => void) => void;

  send: (channel: string, data?: any) => void;
  sendSync: <T>(channel: string, data?: any) => T;
  invoke: <T>(channel: string, data?: any) => Promise<T>;

  removeListener: (channel: string, func: (...args: any[]) => void) => void;
}
