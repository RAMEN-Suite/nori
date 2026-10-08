import { Component, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { Button, Fieldset, FieldsetLegend } from '@sushi-kit/angular';

import { NodeRelationComponent } from './node-relation/node-relation.component';
import { DialogService, DialogRef } from '../../../../services/dialog.service';
import { CreateRelationDialog } from '../../dialogs/create-relation/create-relation.dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-relations',
  imports: [Button, Fieldset, FieldsetLegend, NodeRelationComponent],
  templateUrl: './node-relations.component.html',
  styleUrl: './node-relations.component.scss',
})
export class NodeRelationsComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DialogRef | null = null;

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected handleOpenCreateRelation(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateRelationDialog, {
      header: 'Add Relationship',
    });
  }
}
