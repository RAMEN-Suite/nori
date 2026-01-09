declare global {
  interface Window {
    electron?: Electron;
    platform?: string;
  }
}

export interface Electron {
  on: (channel: string, func: (...args: any[]) => void) => void;

  send: (channel: string, data?: any) => void;
  sendSync: <T>(channel: string, data?: any) => T;
  invoke: <T>(channel: string, data?: any) => Promise<T>;

  removeListener: (channel: string, func: (...args: any[]) => void) => void;
}
