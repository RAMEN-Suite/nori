import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePlus } from '@lucide/angular';
import { Button, List, ListItemTemplate } from '@sushi-kit/angular';
import { DialogService, type DialogRef } from '../../../../services/dialog.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { CreateRelationDialog } from '../../dialogs/create-relation/create-relation.dialog';
import { NodeRelationComponent } from './node-relation/node-relation.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-relations',
  imports: [TranslocoDirective, LucidePlus, Button, List, ListItemTemplate, NodeRelationComponent],
  templateUrl: './node-relations.component.html',
  styleUrl: './node-relations.component.scss',
})
export class NodeRelationsComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly dialogs: DialogService = inject(DialogService);

  private dialogRef: DialogRef | null = null;

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected handleOpenCreateRelation(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogs.open(CreateRelationDialog, {
      headerKey: 'editor.addRelationship',
    });
  }
}
