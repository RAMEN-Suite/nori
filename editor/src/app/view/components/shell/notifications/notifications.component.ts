import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
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
    <section
      class="notification-region"
      [class.node-editor]="context() === 'node-editor'"
      [attr.aria-label]="'common.notifications' | transloco"
    >
      @if (notifications.current(); as notification) {
        <nori-feedback
          class="notification-window"
          kind="status"
          [severity]="notification.status"
          [title]="notification.title"
          [description]="notification.message"
          [animate.enter]="appearance.state().animations ? 'notification-enter' : ''"
          [animate.leave]="appearance.state().animations ? 'notification-leave' : ''"
          (pointerenter)="setInteraction('hover', true)"
          (pointerleave)="setInteraction('hover', false)"
          (focusin)="setInteraction('focus', true)"
          (focusout)="handleFocusOut($event)"
        >
          @if (notification.action; as action) {
            <button
              feedbackActions
              suiButton
              type="button"
              size="sm"
              variant="outlined"
              severity="neutral"
              (click)="notifications.runAction(notification)"
            >
              {{ action.label }}
            </button>
          }
          <button
            feedbackActions
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
  public readonly context: InputSignal<'workspace' | 'node-editor'> = input<'workspace' | 'node-editor'>('workspace');
  protected readonly appearance: ApplicationState = inject(ApplicationState);
  protected readonly notifications: NotificationService = inject(NotificationService);
  private readonly interactions: Record<'hover' | 'focus', boolean> = { hover: false, focus: false };

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
    if (this.interactions[kind] === active) return;
    this.interactions[kind] = active;
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
