import { LucidePencil, LucideTrash, LucidePlus, LucideX } from '@lucide/angular';
import { ChangeDetectionStrategy, Component, inject, output, type OutputEmitterRef } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { Button, List, ListItemTemplate, Tooltip, type ListTrackBy } from '@sushi-kit/angular';
import { StorageService } from '../../../services/storage.service';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { NavigationService } from '../../../services/navigation.service';
import { DialogService } from '../../../services/dialog.service';
import { CreateModelDialog } from '../dialogs/create-model/create-model.dialog';
import { ConfirmationDialog, type ConfirmationOptions } from '../dialogs/confirmation/confirmation.dialog';
import { type ModelRecord } from '../../../models/ModelRecord';
import { type ModelRemovalPreview } from '@ramen-suite/core/model';

@Component({
  selector: 'app-model-levels',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, List, ListItemTemplate, Tooltip, LucidePencil, LucideTrash, LucidePlus, LucideX],
  templateUrl: './model-levels.component.html',
  styleUrl: './model-levels.component.scss',
})
export class ModelLevelsComponent {
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly dialogs: DialogService = inject(DialogService);

  private readonly translations: TranslocoService = inject(TranslocoService);

  public readonly closePanel: OutputEmitterRef<void> = output();
  protected readonly trackLevel: ListTrackBy<ModelRecord> = (_index: number, record: ModelRecord): string => record.modelId;

  protected levelSource(record: ModelRecord): string {
    const names: string[] = record.gmodel.imports.map(
      (reference): string => this.storage.modelsById().get(reference.modelId)?.name ?? reference.modelId,
    );
    return names.length
      ? this.translations.translate('editor.levelBasedOn', { name: names.join(', ') })
      : this.translations.translate('editor.independentModel');
  }

  protected async handleSelect(slot: number): Promise<void> {
    await this.navigation.navigateToSlot(slot);
  }

  protected handleCreate(): void {
    this.dialogs.open(CreateModelDialog, { headerKey: 'editor.createLevel' });
  }

  protected handleEdit(record: ModelRecord): void {
    this.dialogs.open(CreateModelDialog, { headerKey: 'editor.editLevel', inputValues: { currentSlot: record.slot } });
  }

  protected handleRemove(record: ModelRecord): void {
    const preview: ModelRemovalPreview = this.workspace.actions.previewSlotRemoval(record.slot);
    const options: ConfirmationOptions = {
      title: this.translations.translate('editor.removeLevel'),
      plainText: true,
      message: this.translations.translate('editor.confirmRemoveLevels', {
        names: preview.models.map((model): string => model.name).join(', '),
      }),
      buttons: [
        [{ label: this.translations.translate('common.cancel') }],
        [
          {
            label: this.translations.translate('editor.removeLevel'),
            severity: 'error',
            click: async (): Promise<void> => {
              await this.workspace.actions.removeSlot(record.slot, true);
              const next: ModelRecord | undefined = this.storage.records().find((item: ModelRecord): boolean => item.slot !== 0);
              await this.navigation.navigateToSlot(next?.slot ?? 0);
            },
          },
        ],
      ],
    };
    this.dialogs.open(ConfirmationDialog, { inputValues: { options } });
  }
}
