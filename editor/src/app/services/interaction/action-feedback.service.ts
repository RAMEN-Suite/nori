import { computed, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { type LucideIconData } from '@lucide/angular';
import { type ActionFeedbackOwner, type FeedbackSeverity } from '../../models/Feedback';
import { InteractionBlockedError } from '../../models/InteractionBlockedError';
import { NotificationService } from './notification.service';

export interface ActionFeedbackOptions {
  readonly owner: ActionFeedbackOwner;
  readonly title: string;
  readonly description: string;
  readonly severity: FeedbackSeverity;
  readonly icon?: LucideIconData;
  readonly label: string;
  readonly buttonIcon?: LucideIconData;
  readonly run: () => void | Promise<void>;
  readonly cancel: () => void;
}

export interface ActionFeedback extends ActionFeedbackOptions {
  readonly id: string;
}

/** One persistent bottom slot. Owners explicitly release actions; no action has a timer. */
@Injectable({ providedIn: 'root' })
export class ActionFeedbackService {
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly entries: WritableSignal<ReadonlyMap<string, ActionFeedback>> = signal(new Map());
  private readonly running: WritableSignal<string | null> = signal(null);
  private sequence: number = 0;
  public readonly current: Signal<ActionFeedback | null> = computed((): ActionFeedback | null => {
    const actions: readonly ActionFeedback[] = [...this.entries().values()];
    return actions.find((action): boolean => action.owner === 'removal-review') ?? actions[0] ?? null;
  });
  public readonly pending: Signal<boolean> = computed((): boolean => this.running() !== null);

  public publish(options: ActionFeedbackOptions): string {
    const id: string = this.entries().get(options.owner)?.id ?? `nori-action-${++this.sequence}`;
    this.entries.update(
      (entries): ReadonlyMap<string, ActionFeedback> => new Map(entries).set(options.owner, { ...options, id }),
    );
    return id;
  }

  public release(id: string): void {
    this.entries.update(
      (entries): ReadonlyMap<string, ActionFeedback> => new Map([...entries].filter(([, action]): boolean => action.id !== id)),
    );
  }

  public cancel(action: ActionFeedback): void {
    if (this.current() !== action || this.pending()) return;
    action.cancel();
    this.release(action.id);
  }

  public async run(action: ActionFeedback): Promise<void> {
    if (this.current() !== action || this.pending()) return;
    this.running.set(action.id);
    try {
      await action.run();
    } catch (error: unknown) {
      if (error instanceof InteractionBlockedError && error.explainedByAction) return;
      this.notifications.show({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      this.running.set(null);
    }
  }
}
