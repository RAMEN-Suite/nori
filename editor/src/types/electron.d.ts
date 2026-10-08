declare global {
  interface Window {
    electron?: Electron;
    platform?: string;
  }
}

/** The desktop bridge exposes only actions used by the editor. */
export interface Electron {
  minimise(): void;
  maximise(): void;
  close(): void;
  openExternal(url: string): Promise<void>;
}
