import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft, LucideDynamicIcon, LucideX } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { RunningActionService } from '../../../../services/workspace/workflows/running-action.service';

@Component({
  selector: 'nori-running-action-notification',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, LucideArrowLeft, LucideDynamicIcon, LucideX],
  template: `
    @if (actions.current(); as action) {
      <aside
        *transloco="let t"
        class="running-action-notification"
        [attr.data-severity]="action.severity"
        [attr.aria-label]="t(action.titleKey)"
      >
        <span class="action-icon" aria-hidden="true"><svg [lucideIcon]="action.icon" class="size-4"></svg></span>
        <span class="action-content flex-1">
          <span class="feedback-title" role="status">{{ t(action.titleKey) }}</span>
          <span class="feedback-description">{{ t(action.descriptionKey) }}</span>
        </span>
        <button
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
      </aside>
    }
  `,
  styleUrl: './running-action-notification.component.scss',
})
export class RunningActionNotificationComponent {
  protected readonly actions: RunningActionService = inject(RunningActionService);
}
