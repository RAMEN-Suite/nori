import { ChangeDetectionStrategy, Component, computed, inject, input, type InputSignal, type Signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon, LucideX } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { FeedbackComponent } from '../../shared/feedback/feedback.component';
import { ActionFeedbackService } from '../../../../services/interaction/action-feedback.service';
import { ApplicationState } from '../../../../states/application.state';
import {
  InteractionStateService,
  type InteractionAttention,
  type InteractionState,
} from '../../../../services/interaction/interaction-state.service';

/** The only action outlet in the active view; status and action never share state or timers. */
@Component({
  selector: 'nori-action-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [FeedbackComponent, TranslocoPipe, Button, LucideDynamicIcon, LucideX],
  template: `
    @if (actions.current(); as action) {
      @let conflict = attention();
      <nori-feedback
        class="action-window"
        [class.node-editor]="context() === 'node-editor'"
        [class.attention-odd]="appearance.isMotionEnabled() && conflict !== null && conflict.sequence % 2 === 1"
        [class.attention-even]="appearance.isMotionEnabled() && conflict !== null && conflict.sequence % 2 === 0"
        kind="action"
        [severity]="action.severity"
        [title]="action.title"
        [description]="conflict ? (attentionMessage() | transloco) : action.description"
        [icon]="action.icon"
        [animate.enter]="appearance.isMotionEnabled() ? 'feedback-enter' : ''"
        [animate.leave]="appearance.isMotionEnabled() ? 'feedback-leave' : ''"
      >
        <button
          feedbackActions
          suiButton
          size="sm"
          severity="neutral"
          variant="outlined"
          [disabled]="actions.isPending()"
          [loading]="actions.isPending()"
          (click)="actions.run(action)"
        >
          @if (action.buttonIcon; as icon) {
            <svg [lucideIcon]="icon" class="size-4" aria-hidden="true"></svg>
          }
          {{ action.label }}
        </button>
        <button
          feedbackDismiss
          suiButton
          size="sm"
          severity="neutral"
          variant="text"
          shape="circle"
          [disabled]="actions.isPending()"
          [attr.aria-label]="'common.close' | transloco"
          (click)="actions.cancel(action)"
        >
          <svg lucideX class="size-4" aria-hidden="true"></svg>
        </button>
      </nori-feedback>
    }
  `,
  styleUrl: './action-feedback.component.scss',
})
export class ActionFeedbackComponent {
  public readonly context: InputSignal<'workspace' | 'node-editor'> = input<'workspace' | 'node-editor'>('workspace');
  protected readonly actions: ActionFeedbackService = inject(ActionFeedbackService);
  protected readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly interactions: InteractionStateService = inject(InteractionStateService);
  protected readonly attention: Signal<InteractionAttention | null> = computed(() => {
    const state: InteractionState = this.interactions.current();
    const attention: InteractionAttention | null = this.interactions.attention();
    return state.phase !== 'ready' && state.owner === this.actions.current()?.owner && state.id === attention?.interactionId
      ? attention
      : null;
  });
  protected readonly attentionMessage: Signal<string> = computed(() =>
    this.interactions.current().phase === 'executing' ? 'editor.operationInProgress' : 'editor.resolvePendingAction',
  );
}
