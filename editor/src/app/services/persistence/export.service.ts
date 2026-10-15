import { Injectable } from '@angular/core';

/** Saves exported files through the browser’s file picker or a download fallback. */
@Injectable({
  providedIn: 'root',
})
export class ExportService {
  public async exportJSON(data: unknown, fileName: string): Promise<void> {
    await this.exportBlob(new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' }), fileName, 'JSON');
  }

  public async exportBlob(blob: Blob, fileName: string, description: string): Promise<void> {
    if (this.isFileSystemAccessSupported()) {
      try {
        await this.exportWithFilePicker(blob, fileName, description);
        return;
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        throw error;
      }
    }

    this.exportWithBlob(blob, fileName);
  }

  private async exportWithFilePicker(blob: Blob, fileName: string, description: string): Promise<void> {
    const extension: string | undefined = /\.[^.]+$/.exec(fileName)?.[0];
    const handle: FileSystemFileHandle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: extension ? [{ description, accept: { [blob.type]: [extension] } }] : [],
    });

    const writable: FileSystemWritableFileStream = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  private exportWithBlob(blob: Blob, fileName: string): void {
    const url: string = URL.createObjectURL(blob);
    try {
      const anchor: HTMLAnchorElement = Object.assign(document.createElement('a'), {
        href: url,
        download: fileName,
      });

      anchor.click();
    } finally {
      window.setTimeout((): void => URL.revokeObjectURL(url), 1000);
    }
  }

  private isFileSystemAccessSupported(): boolean {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  }
}
