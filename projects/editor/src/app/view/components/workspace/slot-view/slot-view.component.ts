import { Component, DestroyRef, inject } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { Button } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CreateModelDialog } from '../../dialogs/create-model/create-model.dialog';
import { ScrollPanel } from 'primeng/scrollpanel';
import { StorageService } from '../../../../services/storage.service';
import { Panel } from 'primeng/panel';
import { Fieldset } from 'primeng/fieldset';

@Component({
  selector: 'app-slot-view',
  imports: [Button, ScrollPanel, Panel, Fieldset],
  providers: [DialogService, DynamicDialogRef],
  templateUrl: './slot-view.component.html',
  styleUrl: './slot-view.component.scss',
})
export class SlotViewComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

  protected handleOpenCreateModel(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateModelDialog, {
      header: 'Create Domain Model',
      closeOnEscape: true,
      draggable: true,
      closable: true,
    });
  }
}
