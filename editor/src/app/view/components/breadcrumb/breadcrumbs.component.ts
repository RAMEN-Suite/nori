import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Button } from '@sushi-kit/angular';
import { StorageService } from '../../../services/storage.service';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { NavigationService } from '../../../services/navigation.service';
import { DialogService } from '../../../services/dialog.service';
import { CreateModelDialog } from '../dialogs/create-model/create-model.dialog';
import { ConfirmationDialog, type ConfirmationOptions } from '../dialogs/confirmation/confirmation.dialog';
import { type ModelRecord } from '../../../models/ModelRecord';
import { type ModelRemovalPreview } from '@ramen-suite/core/model';

@Component({
  selector: 'app-breadcrumbs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './breadcrumbs.component.html',
  styleUrl: './breadcrumbs.component.scss',
})
export class BreadcrumbsComponent {
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly dialogs: DialogService = inject(DialogService);

  protected async handleSelect(slot: number): Promise<void> {
    await this.navigation.navigateToSlot(slot);
  }

  protected handleCreate(): void {
    this.dialogs.open(CreateModelDialog, { header: 'Create model level' });
  }

  protected handleEdit(record: ModelRecord): void {
    this.dialogs.open(CreateModelDialog, { header: 'Edit model level', inputValues: { currentSlot: record.slot } });
  }

  protected canRemove(record: ModelRecord): boolean {
    return record.gmodel.imports.some((entry): boolean =>
      this.storage.records().some((parent: ModelRecord): boolean => parent.slot !== 0 && parent.gmodel.id === entry.modelId),
    );
  }

  protected handleRemove(record: ModelRecord): void {
    const preview: ModelRemovalPreview = this.workspace.actions.previewSlotRemoval(record.slot);
    const options: ConfirmationOptions = {
      title: 'Remove model level',
      message: `Remove ${record.name}? This also removes ${preview.models.length - 1} dependent model levels.`,
      buttons: [
        [{ label: 'Cancel' }],
        [
          {
            label: 'Remove with dependants',
            severity: 'error',
            click: async (): Promise<void> => {
              await this.workspace.actions.removeSlot(record.slot, true);
              await this.navigation.navigateToSlot(1);
            },
          },
        ],
      ],
    };
    this.dialogs.open(ConfirmationDialog, { inputValues: { options } });
  }
}
