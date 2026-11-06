import { inject, Injectable, signal, type Type, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

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

/** Owns the active dialog and its pending/error state. */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly translations: TranslocoService = inject(TranslocoService);
  public readonly current: WritableSignal<OpenDialog | null> = signal(null);
  public readonly isDetailsOpen: WritableSignal<boolean> = signal(false);
  public readonly error: WritableSignal<string | null> = signal(null);
  public readonly isPending: WritableSignal<boolean> = signal(false);

  public open(component: Type<unknown>, options: DialogOptions = {}): DialogRef {
    this.error.set(null);
    this.isDetailsOpen.set(options.detailsOpen ?? false);

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
    if (!this.isPending()) this.current.set(null);
  }

  public async run(action: () => Promise<void>, options: { closeOnSuccess?: boolean } = {}): Promise<void> {
    if (this.isPending()) return;
    this.isPending.set(true);
    this.error.set(null);

    try {
      await action();
      if (options.closeOnSuccess !== false) this.current.set(null);
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : this.translations.translate('common.notificationTitles.error'));
    } finally {
      this.isPending.set(false);
    }
  }
}
