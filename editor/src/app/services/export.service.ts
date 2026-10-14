import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  public async exportJSON(data: unknown, fileName: string): Promise<void> {
    const contents: string = JSON.stringify(data, null, 4);
    if (this.isFileSystemAccessSupported()) {
      try {
        await this.exportWithFilePicker(contents, fileName);
        return;
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        throw error;
      }
    }

    this.exportWithBlob(contents, fileName);
  }

  private async exportWithFilePicker(content: string, fileName: string): Promise<void> {
    const handle: FileSystemFileHandle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: 'JSON',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });

    const writable: FileSystemWritableFileStream = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  private exportWithBlob(content: string, fileName: string): void {
    const blob: Blob = new Blob([content], { type: 'application/json;charset=utf-8' });

    const url: string = URL.createObjectURL(blob);
    try {
      const anchor: HTMLAnchorElement = Object.assign(document.createElement('a'), {
        href: url,
        download: fileName,
      });

      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private isFileSystemAccessSupported(): boolean {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  }
}
