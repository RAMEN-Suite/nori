import { Component, DestroyRef, inject } from '@angular/core';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { Button } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CreateModelDialog } from '../dialogs/create-model/create-model.dialog';
import { SchemaValidator } from '@ramen-suite/core/gcore';
import { StorageService } from '../../../services/storage.service';
import { ConfirmationDialog, ConfirmationOptions } from '../dialogs/confirmation/confirmation.dialog';

@Component({
  selector: 'app-slot-view',
  imports: [Button],
  providers: [DialogService],
  templateUrl: './slot-view.component.html',
  styleUrl: './slot-view.component.scss',
})
export class SlotViewComponent {
  protected readonly storage: StorageService = inject(StorageService);
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

  protected handleOpenCreateModel(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateModelDialog, {
      header: 'Create Project Model',
      closeOnEscape: true,
      draggable: true,
      closable: true,
    });
  }

  protected async handleImportModel(input: HTMLInputElement): Promise<void> {
    const file: File | undefined = input.files?.[0];
    if (!file) return;
    input.value = '';

    try {
      const text: string = await file.text();
      const contents: unknown = JSON.parse(text);
      SchemaValidator.assertValid(contents);
      await this.storage.importRecord(contents);
    } catch (error: unknown) {
      console.error('Unable to import selected model:', error);
      this.openErrorDialog();
    }
  }

  private openErrorDialog(): void {
    const options: ConfirmationOptions = {
      title: 'Import has failed',
      message: `The selected model cannot be imported. <br /> Please check your selection and try again.`,
      icon: 'pi-exclamation-circle',
      justify: 'justify-around',
      buttons: [[{ label: 'Close', variant: 'outlined', click: (): void => this.dialogRef?.close() }]],
    };

    this.dialogRef = this.dialogService.open(ConfirmationDialog, {
      showHeader: false,
      closeOnEscape: true,
      dismissableMask: true,
      closable: true,
      inputValues: { options },
    });
  }
}
