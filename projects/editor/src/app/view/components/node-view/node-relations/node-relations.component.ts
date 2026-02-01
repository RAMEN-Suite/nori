import { Component, DestroyRef, inject } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { Button } from 'primeng/button';
import { Fieldset } from 'primeng/fieldset';
import { NodeRelationComponent } from './node-relation/node-relation.component';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CreateRelationDialog } from '../../dialogs/create-relation/create-relation.dialog';

@Component({
  selector: 'app-node-relations',
  imports: [Button, Fieldset, NodeRelationComponent],
  providers: [DynamicDialogRef, DialogService],
  templateUrl: './node-relations.component.html',
  styleUrl: './node-relations.component.scss',
})
export class NodeRelationsComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

  constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected handleOpenCreateRelation(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateRelationDialog, {
      header: 'Add Relationship',
      closeOnEscape: true,
      draggable: true,
      closable: true,
    });
  }
}
