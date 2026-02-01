import { Injectable } from '@angular/core';

export interface ExportOptions {
  fileName?: string;
  isPretty?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  public async exportJSON(data: unknown, options?: ExportOptions): Promise<void> {
    const fileName: string = options?.fileName ?? 'data.json';
    const isPretty: boolean = options?.isPretty ?? true;

    const contents: string = JSON.stringify(data, null, isPretty ? 4 : 0);
    if (this.isFileSystemAccessSupported()) {
      try {
        await this.exportWithFilePicker(contents, fileName);
        return;
      } catch {
        console.error('Could not export via FileSystem API.');
        return;
      }
    }

    this.exportWithBlob(contents, fileName);
  }

  protected async exportWithFilePicker(content: string, fileName: string): Promise<void> {
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

  protected exportWithBlob(content: string, fileName: string): void {
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
