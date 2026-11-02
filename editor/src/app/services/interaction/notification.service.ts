import { DestroyRef, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { type FeedbackSeverity } from '../../models/Feedback';

export type NotificationStatus = FeedbackSeverity;

export interface NotificationOptions {
  readonly status: NotificationStatus;
  readonly message: string;
  readonly title?: string;
  readonly action?: never;
}

export interface StatusNotification extends NotificationOptions {
  readonly id: string;
  readonly title: string;
}

/** One transient feedback window; new messages replace its contents in place. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly state: WritableSignal<StatusNotification | null> = signal(null);
  public readonly current: Signal<StatusNotification | null> = this.state.asReadonly();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private remaining: number = 6000;
  private startedAt: number = 0;
  private pauses: number = 0;
  private sequence: number = 0;

  public constructor() {
    inject(DestroyRef).onDestroy((): void => this.clearTimer());
  }

  public show(options: NotificationOptions): string {
    this.clearTimer();
    const id: string = `nori-notification-${++this.sequence}`;
    this.state.set({
      ...options,
      id,
      title: options.title ?? this.translations.translate(`common.notificationTitles.${options.status}`),
    });
    this.remaining = 6000;
    this.schedule();
    return id;
  }

  public dismiss(id: string): void {
    // An older workflow must not dismiss a newer message that replaced its own.
    if (this.current()?.id !== id) return;
    this.clearTimer();
    this.state.set(null);
  }

  public pause(): void {
    this.pauses += 1;
    if (this.pauses !== 1 || this.timer === null) return;
    this.remaining = Math.max(0, this.remaining - (performance.now() - this.startedAt));
    this.clearTimer();
  }

  public resume(): void {
    if (this.pauses === 0) return;
    this.pauses -= 1;
    this.schedule();
  }

  private schedule(): void {
    const id: string | undefined = this.current()?.id;
    if (!id || this.pauses > 0 || this.timer !== null) return;
    this.startedAt = performance.now();
    this.timer = setTimeout((): void => this.dismiss(id), this.remaining);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
