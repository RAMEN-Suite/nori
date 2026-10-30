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
import { LucideCircleCheck, LucideCircleX, LucideInfo, LucideTriangleAlert, LucideX } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { NotificationService } from '../../../../services/interaction/notification.service';
import { ApplicationState } from '../../../../states/application.state';

@Component({
  selector: 'nori-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [Button, TranslocoPipe, LucideCircleCheck, LucideCircleX, LucideInfo, LucideTriangleAlert, LucideX],
  template: `
    <section
      class="notification-region"
      [class.node-editor]="context() === 'node-editor'"
      [attr.aria-label]="'common.notifications' | transloco"
    >
      @if (notifications.current(); as notification) {
        <div
          class="notification-window"
          [attr.data-severity]="notification.status"
          [animate.enter]="appearance.state().animations ? 'notification-enter' : ''"
          [animate.leave]="appearance.state().animations ? 'notification-leave' : ''"
          [attr.role]="notification.status === 'error' || notification.status === 'warning' ? 'alert' : 'status'"
          aria-atomic="true"
          (pointerenter)="setInteraction('hover', true)"
          (pointerleave)="setInteraction('hover', false)"
          (focusin)="setInteraction('focus', true)"
          (focusout)="handleFocusOut($event)"
        >
          <span class="notification-icon" aria-hidden="true">
            @switch (notification.status) {
              @case ('error') {
                <svg lucideCircleX class="size-4"></svg>
              }
              @case ('warning') {
                <svg lucideTriangleAlert class="size-4"></svg>
              }
              @case ('info') {
                <svg lucideInfo class="size-4"></svg>
              }
              @case ('success') {
                <svg lucideCircleCheck class="size-4"></svg>
              }
            }
          </span>
          <span class="notification-content">
            <strong class="feedback-title">{{ notification.title }}</strong>
            <span class="feedback-description">{{ notification.message }}</span>
            @if (notification.action; as action) {
              <button
                suiButton
                type="button"
                size="sm"
                variant="outlined"
                severity="neutral"
                class="justify-self-start"
                (click)="notifications.runAction(notification)"
              >
                {{ action.label }}
              </button>
            }
          </span>
          <button
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
        </div>
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
