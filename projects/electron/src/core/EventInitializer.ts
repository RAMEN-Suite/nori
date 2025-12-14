import { ipcMain } from 'electron';
import IpcMain = Electron.IpcMain;

export interface ListenerMap {
  [listener: string]: {
    type: 'on' | 'handle';
    fn: Function;
  };
}

export abstract class Listener {
  protected constructor(...args: unknown[]) {}
  protected listener: ListenerMap;

  public listen(): void {
    for (const [event, details] of Object.entries(this.listener)) {
      ipcMain[details.type](event, (...args: unknown[]): IpcMain => {
        console.log('->', event, args.slice(1));
        return details.fn.bind(this, ...args)();
      });
    }
  }
}

export class EventInitializer {
  protected readonly listener: { new (): Listener }[] = [];
  public readonly instances: Listener[] = [];

  constructor(listener: { new (...args: unknown[]): Listener }[], ...args: unknown[]) {
    this.listener.push(...listener);
    this.prepare(...args);
  }

  public init(): void {
    this.instances.forEach((instance: Listener): void => instance.listen());
  }

  protected prepare(...args: unknown[]): void {
    this.listener.forEach((listener: new () => Listener): void => {
      this.instances.push(new listener(...(args as [])));
    });
  }
}
