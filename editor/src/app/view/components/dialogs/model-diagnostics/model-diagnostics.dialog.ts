import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';
import { Button, List, ListItemTemplate, Message } from '@sushi-kit/angular';
import { DialogService } from '../../../../services/dialog.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';

@Component({
  selector: 'nori-model-diagnostics-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX, TranslocoDirective, Button, List, ListItemTemplate, Message],
  templateUrl: './model-diagnostics.dialog.html',
})
export class ModelDiagnosticsDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly dialogs: DialogService = inject(DialogService);
}
