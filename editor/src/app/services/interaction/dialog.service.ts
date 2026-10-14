import { DOCUMENT, inject, Injectable, signal, type Type, type WritableSignal } from '@angular/core';

export type DialogSize = 'compact' | 'form';

export interface DialogOptions {
  readonly size?: DialogSize;
  readonly detailsOpen?: boolean;
  readonly closeOnBackdrop?: boolean;
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
  readonly closeOnBackdrop: boolean;
  readonly title: string;
  readonly titleKey: string | null;
  readonly width: string | null;
  readonly inputs: Record<string, unknown>;
}

/** Owns the active dialog, its pending/error state and focus restoration for tooltips. */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly document: Document = inject(DOCUMENT);

  private tooltipRestoreTarget: Element | null = null;
  public readonly current: WritableSignal<OpenDialog | null> = signal(null);
  public readonly detailsOpen: WritableSignal<boolean> = signal(false);
  public readonly error: WritableSignal<string | null> = signal(null);
  public readonly pending: WritableSignal<boolean> = signal(false);

  public consumeRestoredFocus(target: Element): boolean {
    if (target !== this.tooltipRestoreTarget) return false;
    this.tooltipRestoreTarget = null;
    return true;
  }

  public open(component: Type<unknown>, options: DialogOptions = {}): DialogRef {
    this.tooltipRestoreTarget = this.document.activeElement;
    this.error.set(null);
    this.detailsOpen.set(options.detailsOpen ?? false);

    const dialog: OpenDialog = {
      component,
      closeOnBackdrop: options.closeOnBackdrop ?? false,
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
