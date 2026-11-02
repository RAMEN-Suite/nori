import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideEraser, LucideSpline, type LucideIconData } from '@lucide/angular';
import { FeedbackComponent } from '../../../shared/feedback/feedback.component';
import { GraphToolsService } from '../../../../../services/workspace/editing/graph-tools.service';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';

/** Persistent, non-interactive guidance for the active graph editing mode. */
@Component({
  selector: 'nori-graph-mode-hint',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, FeedbackComponent],
  template: `
    <ng-container *transloco="let t">
      @let source = tools.source();
      <nori-feedback
        kind="hint"
        severity="info"
        [icon]="tools.tool() === 'connect' ? connectIcon : eraseIcon"
        [title]="
          tools.tool() === 'connect'
            ? source
              ? t('editor.connectionSourceHint', { name: workspace.store.getDraft().getNode(source)?.name })
              : t('editor.connectHint')
            : t('editor.eraseElements')
        "
        [description]="t(tools.tool() === 'connect' ? 'editor.connectSelfHint' : 'editor.eraseHint')"
      />
    </ng-container>
  `,
  styleUrl: './graph-mode-hint.component.scss',
})
export class GraphModeHintComponent {
  protected readonly connectIcon: LucideIconData = LucideSpline.icon;
  protected readonly eraseIcon: LucideIconData = LucideEraser.icon;
  protected readonly tools: GraphToolsService = inject(GraphToolsService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
}
