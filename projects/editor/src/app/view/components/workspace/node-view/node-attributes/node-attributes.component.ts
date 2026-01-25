import { Component, DestroyRef, inject } from '@angular/core';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { Fieldset } from 'primeng/fieldset';
import { NodeAttributeComponent } from './node-attribute/node-attribute.component';
import { Button } from 'primeng/button';
import { CreateAttributeDialog } from '../../../dialogs/create-attribute/create-attribute.dialog';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-node-attributes',
  imports: [Fieldset, NodeAttributeComponent, Button],
  providers: [DialogService, DynamicDialogRef],
  templateUrl: './node-attributes.component.html',
  styleUrl: './node-attributes.component.scss',
})
export class NodeAttributesComponent {
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

  protected handleOpenCreateAttribute(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateAttributeDialog, {
      header: 'Create Attribute',
      closeOnEscape: true,
      draggable: true,
      closable: true,
      modal: true,
      dismissableMask: true,
    });
  }
}
