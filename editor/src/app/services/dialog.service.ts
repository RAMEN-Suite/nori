import { Injectable, signal, type Type, type WritableSignal } from '@angular/core';

export type DialogSize = 'compact' | 'form';

export interface DialogOptions {
  readonly size?: DialogSize;
  readonly header?: string;
  readonly headerKey?: string;
  readonly width?: string;
  readonly inputValues?: Record<string, unknown>;
}

export interface DialogRef {
  close(): void;
}

export interface OpenDialog {
  readonly component: Type<unknown>;
  readonly title: string;
  readonly titleKey: string | null;
  readonly width: string | null;
  readonly inputs: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  public readonly current: WritableSignal<OpenDialog | null> = signal(null);
  public readonly error: WritableSignal<string | null> = signal(null);
  public readonly pending: WritableSignal<boolean> = signal(false);

  public open(component: Type<unknown>, options: DialogOptions = {}): DialogRef {
    this.error.set(null);
    const dialog: OpenDialog = {
      component,
      title: options.header ?? '',
      titleKey: options.headerKey ?? null,
      width: options.width ?? (options.size === 'compact' ? 'var(--nori-dialog-width-compact)' : null),
      inputs: options.inputValues ?? {},
    };
    this.current.set(dialog);
    return {
      close: (): void => {
        if (this.current() === dialog) this.close();
      },
    };
  }

  public close(): void {
    if (!this.pending()) this.current.set(null);
  }

  public async run(action: () => Promise<void>, options: { closeOnSuccess?: boolean } = {}): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    this.error.set(null);
    try {
      await action();
      if (options.closeOnSuccess !== false) this.current.set(null);
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'The operation could not be completed.');
    } finally {
      this.pending.set(false);
    }
  }
}
