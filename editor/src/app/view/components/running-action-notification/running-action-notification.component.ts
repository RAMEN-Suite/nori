import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft, LucideEraser, LucideX } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { RunningActionService } from '../../../services/running-action.service';

@Component({
  selector: 'nori-running-action-notification',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, LucideArrowLeft, LucideEraser, LucideX],
  template: `
    @if (actions.current(); as action) {
      <aside *transloco="let t" class="running-action-notification" [attr.aria-label]="t(action.titleKey)">
        <span class="action-icon" aria-hidden="true"><svg lucideEraser class="size-4"></svg></span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium" role="status">{{ t(action.titleKey) }}</span>
          <span class="text-base-content/60 mt-0.5 block text-xs">{{ t(action.descriptionKey) }}</span>
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
          shape="square"
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
