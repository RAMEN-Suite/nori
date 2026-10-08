import { Component, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { Button } from '@sushi-kit/angular';
import { DialogService, DialogRef } from '../../../services/dialog.service';
import { CreateModelDialog } from '../dialogs/create-model/create-model.dialog';
import { NavigationService } from '../../../services/navigation.service';
import { StorageService } from '../../../services/storage.service';
import { ConfirmationDialog, ConfirmationOptions } from '../dialogs/confirmation/confirmation.dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-slot-view',
  imports: [Button],
  templateUrl: './slot-view.component.html',
  styleUrl: './slot-view.component.scss',
})
export class SlotViewComponent {
  private readonly navigation: NavigationService = inject(NavigationService);
  protected readonly storage: StorageService = inject(StorageService);
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

  protected handleOpenCreateModel(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateModelDialog, {
      header: 'Create Project Model',
    });
  }

  protected async handleImportModel(input: HTMLInputElement): Promise<void> {
    const file: File | undefined = input.files?.[0];
    if (!file) return;
    input.value = '';

    try {
      const text: string = await file.text();
      const contents: unknown = JSON.parse(text);
      const projectId: string = await this.storage.importRecord(contents);
      await this.navigation.navigateToProject(projectId);
    } catch (error: unknown) {
      console.error('Unable to import selected model:', error);
      this.openErrorDialog();
    }
  }

  private openErrorDialog(): void {
    const options: ConfirmationOptions = {
      title: 'Import has failed',
      message: `The selected model cannot be imported. <br /> Please check your selection and try again.`,

      justify: 'justify-around',
      buttons: [[{ label: 'Close', variant: 'outlined', click: (): void => this.dialogRef?.close() }]],
    };

    this.dialogRef = this.dialogService.open(ConfirmationDialog, {
      inputValues: { options },
    });
  }
}
