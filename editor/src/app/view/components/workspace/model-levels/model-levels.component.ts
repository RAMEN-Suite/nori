import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  linkedSignal,
  type WritableSignal,
  type Signal,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucidePencil, LucidePlus, LucideTrash } from '@lucide/angular';
import { type ModelRemovalPreview } from '@ramen-suite/core/model';
import { Button, List, ListItemTemplate, type ListTrackBy } from '@sushi-kit/angular';
import { getRemovedModelImpact } from '../../../../utils/removal-summary';
import { InlineRename } from '../../shared/inline-name-input/inline-rename';
import { InlineNameInputComponent } from '../../shared/inline-name-input/inline-name-input.component';
import { ScrollOverflowDirective } from '../../../../directives/scroll-overflow.directive';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { type ModelRecord } from '../../../../models/ModelRecord';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { NavigationService } from '../../../../services/interaction/navigation.service';
import { ProjectService } from '../../../../services/projects/project.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { ConfirmationDialog, type ConfirmationOptions } from '../../dialogs/confirmation/confirmation.dialog';
import { CreateModelDialog } from '../../dialogs/create-model/create-model.dialog';
import { ScrollHintsComponent } from '../../shared/scroll-hints/scroll-hints.component';

@Component({
  selector: 'nori-model-levels',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollOverflowDirective,
    ScrollHintsComponent,
    InlineNameInputComponent,
    TranslocoDirective,
    Button,
    List,
    ListItemTemplate,
    TooltipDirective,
    LucidePencil,
    LucideTrash,
    LucidePlus,
  ],
  templateUrl: './model-levels.component.html',
  styleUrl: './model-levels.component.scss',
})
export class ModelLevelsComponent {
  protected readonly projects: ProjectService = inject(ProjectService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  protected readonly trackLevel: ListTrackBy<ModelRecord> = (_index: number, record: ModelRecord): string => record.modelId;
  private readonly renameContext: Signal<string> = computed((): string =>
    JSON.stringify([this.projects.loadedProjectId(), this.projects.selectedProjectId()]),
  );
  protected readonly editingId: WritableSignal<string | null> = linkedSignal({
    source: (): { context: string; records: ModelRecord[] } => ({
      context: this.renameContext(),
      records: this.projects.records(),
    }),
    computation: ({ context, records }, previous): string | null =>
      previous?.source.context === context && records.some((record: ModelRecord): boolean => record.modelId === previous.value)
        ? previous.value
        : null,
  });
  protected readonly rename: InlineRename<string> = new InlineRename(this.editingId, this.renameContext, (error: unknown): void =>
    this.projects.reportError(error),
  );

  protected readonly levels: Signal<readonly ModelRecord[]> = computed((): readonly ModelRecord[] =>
    [...this.projects.records()].sort((left: ModelRecord, right: ModelRecord): number => right.levelIndex - left.levelIndex),
  );

  protected handleRename(record: ModelRecord): void {
    if (record.levelIndex === 0 || this.rename.isSaving() || record.projectId !== this.projects.selectedProjectId()) return;

    this.rename.start(record.modelId, record.name);
  }

  protected handleSaveName(restoreFocus: boolean = false): Promise<void> {
    const record: ModelRecord | undefined = this.projects
      .records()
      .find((item: ModelRecord): boolean => item.modelId === this.editingId());
    if (!record) return Promise.resolve();
    return this.rename.save(
      (_id: string, name: string): Promise<unknown> =>
        this.workspace.actions.updateLevel(record.levelIndex, {
          name,
          uri: record.gmodel.$id,
          version: record.gmodel.version,
        }),
      (): void => this.handleCancelRename(restoreFocus),
    );
  }

  protected handleCancelRename(restoreFocus: boolean = false): void {
    const id: string | null = this.rename.cancel();
    if (!restoreFocus || !id) return;
    this.rename.restoreFocus((): HTMLButtonElement | null =>
      this.element.nativeElement.querySelector(`button[data-level-id="${CSS.escape(id)}"]`),
    );
  }

  protected levelSource(record: ModelRecord): string {
    const names: string[] = record.gmodel.imports.map(
      (reference): string => this.projects.modelsById().get(reference.modelId)?.name ?? reference.modelId,
    );
    return names.length
      ? this.translations.translate('editor.levelBasedOn', { name: names.join(', ') })
      : this.translations.translate('editor.independentModel');
  }

  protected async handleSelect(levelIndex: number): Promise<void> {
    try {
      await this.navigation.navigateToLevel(levelIndex);
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  protected handleCreate(): void {
    this.dialogs.open(CreateModelDialog, { headerKey: 'editor.createLevel', width: 'var(--nori-dialog-width-edit)' });
  }

  protected handleEdit(record: ModelRecord): void {
    this.dialogs.open(CreateModelDialog, {
      headerKey: 'editor.editLevel',
      width: 'var(--nori-dialog-width-edit)',
      inputValues: { currentLevelIndex: record.levelIndex },
    });
  }

  protected handleRemove(record: ModelRecord): void {
    try {
      this.confirmRemoval(record);
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  private confirmRemoval(record: ModelRecord): void {
    const preview: ModelRemovalPreview = this.workspace.actions.previewLevelRemoval(record.levelIndex);
    const options: ConfirmationOptions = {
      title: this.translations.translate('editor.removeLevelTitle'),
      message: {
        key: 'editor.confirmRemoveLevels',
        params: {
          name: record.name,
        },
      },
      ...getRemovedModelImpact(this.workspace.store.getModels(), preview.models, this.projects.records(), record.gmodel.id),
      buttons: [
        [{ label: this.translations.translate('common.cancel'), severity: 'neutral' }],
        [
          {
            label: this.translations.translate('editor.removeLevel'),
            severity: 'error',
            click: (): Promise<void> => this.removeLevel(record),
          },
        ],
      ],
    };
    this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
  }

  private async removeLevel(record: ModelRecord): Promise<void> {
    if (this.projects.recordsByLevelIndex().get(record.levelIndex)?.modelId !== record.modelId) {
      throw new Error(this.translations.translate('editor.modelChanged'));
    }

    await this.workspace.actions.removeLevel(record.levelIndex, true);
    const next: ModelRecord | undefined = this.projects.records().find((item: ModelRecord): boolean => item.levelIndex !== 0);
    await this.navigation.navigateToLevel(next?.levelIndex ?? 0);
  }
}
