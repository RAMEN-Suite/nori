import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft, LucideX } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { FeedbackComponent } from '../../shared/feedback/feedback.component';
import { RunningActionService } from '../../../../services/workspace/workflows/running-action.service';

@Component({
  selector: 'nori-running-action-notification',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FeedbackComponent, TranslocoDirective, Button, LucideArrowLeft, LucideX],
  template: `
    @if (actions.current(); as action) {
      <nori-feedback
        *transloco="let t"
        class="running-action-notification"
        kind="action"
        [severity]="action.severity"
        [title]="t(action.titleKey)"
        [description]="t(action.descriptionKey)"
        [icon]="action.icon"
      >
        <button
          feedbackActions
          suiButton
          size="sm"
          severity="neutral"
          variant="outlined"
          [disabled]="actions.pending()"
          [loading]="actions.pending()"
          (click)="actions.resume()"
        >
          <svg lucideArrowLeft class="size-4" aria-hidden="true"></svg>{{ t('editor.resumeAction') }}
        </button>
        <button
          feedbackActions
          suiButton
          size="sm"
          severity="neutral"
          variant="text"
          shape="circle"
          [disabled]="actions.pending()"
          [attr.aria-label]="t('editor.cancelRunningAction')"
          (click)="actions.cancel()"
        >
          <svg lucideX class="size-4" aria-hidden="true"></svg>
        </button>
      </nori-feedback>
    }
  `,
  styleUrl: './running-action-notification.component.scss',
})
export class RunningActionNotificationComponent {
  protected readonly actions: RunningActionService = inject(RunningActionService);
}
