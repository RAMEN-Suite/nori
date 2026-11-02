import { ChangeDetectionStrategy, Component, inject, input, type InputSignal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon, LucideX } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { FeedbackComponent } from '../../shared/feedback/feedback.component';
import { ActionFeedbackService } from '../../../../services/interaction/action-feedback.service';
import { ApplicationState } from '../../../../states/application.state';

/** The only action outlet in the active view; status and action never share state or timers. */
@Component({
  selector: 'nori-action-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [FeedbackComponent, TranslocoPipe, Button, LucideDynamicIcon, LucideX],
  template: `
    @if (actions.current(); as action) {
      <nori-feedback
        class="action-window"
        [class.node-editor]="context() === 'node-editor'"
        kind="action"
        [severity]="action.severity"
        [title]="action.title"
        [description]="action.description"
        [icon]="action.icon"
        [animate.enter]="appearance.state().animations ? 'feedback-enter' : ''"
        [animate.leave]="appearance.state().animations ? 'feedback-leave' : ''"
      >
        <button
          feedbackActions
          suiButton
          size="sm"
          severity="neutral"
          variant="outlined"
          [disabled]="actions.pending()"
          [loading]="actions.pending()"
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
          [disabled]="actions.pending()"
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
}
