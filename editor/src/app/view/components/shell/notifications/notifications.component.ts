import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  type WritableSignal,
  untracked,
  type InputSignal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { FeedbackComponent } from '../../shared/feedback/feedback.component';
import { NotificationService } from '../../../../services/interaction/notification.service';
import { ApplicationState } from '../../../../states/application.state';

@Component({
  selector: 'nori-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [FeedbackComponent, Button, TranslocoPipe, LucideX],
  template: `
    <section class="notification-region" [attr.aria-label]="'common.notifications' | transloco">
      @if (notifications.current(); as notification) {
        <nori-feedback
          class="notification-window"
          [class.node-editor]="context() === 'node-editor'"
          [class.in-dialog]="context() === 'dialog'"
          kind="status"
          [severity]="notification.status"
          [title]="notification.title"
          [description]="notification.message"
          [animate.enter]="appearance.isMotionEnabled() ? 'feedback-enter' : ''"
          [animate.leave]="appearance.isMotionEnabled() ? 'feedback-leave' : ''"
          (pointerenter)="setInteraction('hover', true)"
          (pointerleave)="setInteraction('hover', false)"
          (focusin)="setInteraction('focus', true)"
          (focusout)="handleFocusOut($event)"
        >
          <button
            feedbackDismiss
            suiButton
            type="button"
            size="sm"
            shape="circle"
            variant="text"
            severity="neutral"
            [attr.aria-label]="'common.close' | transloco"
            (click)="notifications.dismiss(notification.id)"
          >
            <svg lucideX class="size-4" aria-hidden="true"></svg>
          </button>
        </nori-feedback>
      }
    </section>
  `,
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent {
  public readonly context: InputSignal<'workspace' | 'node-editor' | 'dialog'> = input<'workspace' | 'node-editor' | 'dialog'>(
    'workspace',
  );
  protected readonly appearance: ApplicationState = inject(ApplicationState);
  protected readonly notifications: NotificationService = inject(NotificationService);
  private readonly interactions: WritableSignal<Readonly<Record<'hover' | 'focus', boolean>>> = signal({
    hover: false,
    focus: false,
  });

  public constructor() {
    effect((): void => {
      if (!this.notifications.current()) {
        untracked((): void => {
          this.setInteraction('hover', false);
          this.setInteraction('focus', false);
        });
      }
    });
    inject(DestroyRef).onDestroy((): void => {
      this.setInteraction('hover', false);
      this.setInteraction('focus', false);
    });
  }

  protected setInteraction(kind: 'hover' | 'focus', active: boolean): void {
    if (this.interactions()[kind] === active) return;
    this.interactions.update(
      (current: Readonly<Record<'hover' | 'focus', boolean>>): Readonly<Record<'hover' | 'focus', boolean>> => ({
        ...current,
        [kind]: active,
      }),
    );
    if (active) this.notifications.pause();
    else this.notifications.resume();
  }

  protected handleFocusOut(event: FocusEvent): void {
    const container: EventTarget | null = event.currentTarget;
    if (container instanceof HTMLElement && event.relatedTarget instanceof Node && container.contains(event.relatedTarget))
      return;
    this.setInteraction('focus', false);
  }
}
