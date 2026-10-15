import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  type WritableSignal,
  type Signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucidePencil, LucidePlus, LucideTrash } from '@lucide/angular';
import { type ModelRemovalPreview } from '@ramen-suite/core/model';
import { Button, Input, List, ListItemTemplate, type ListTrackBy } from '@sushi-kit/angular';
import { getRemovedModelImpact } from '../../../../utils/removal-summary';
import { AutoselectDirective } from '../../../../directives/autoselect.directive';
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
    FormsModule,
    AutoselectDirective,
    Input,
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
  private readonly injector: Injector = inject(Injector);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  protected readonly trackLevel: ListTrackBy<ModelRecord> = (_index: number, record: ModelRecord): string => record.modelId;
  protected readonly editingId: WritableSignal<string | null> = signal(null);
  protected readonly draftName: WritableSignal<string> = signal('');
  protected readonly savingName: WritableSignal<boolean> = signal(false);

  protected readonly levels: Signal<readonly ModelRecord[]> = computed((): readonly ModelRecord[] =>
    [...this.projects.records()].sort((left: ModelRecord, right: ModelRecord): number => right.levelIndex - left.levelIndex),
  );

  public constructor() {
    effect((): void => {
      if (!this.projects.records().some((record: ModelRecord): boolean => record.modelId === this.editingId())) {
        this.editingId.set(null);
      }
    });
  }

  protected handleRename(record: ModelRecord): void {
    if (record.levelIndex === 0 || this.savingName()) return;

    this.draftName.set(record.name);
    this.editingId.set(record.modelId);
  }

  protected async handleSaveName(restoreFocus: boolean = false): Promise<void> {
    const id: string | null = this.editingId();
    if (!id || this.savingName()) return;

    const record: ModelRecord | undefined = this.projects.records().find((item: ModelRecord): boolean => item.modelId === id);
    const name: string = this.draftName().trim();
    if (!record || !name) {
      this.handleCancelRename(restoreFocus);
      return;
    }

    this.savingName.set(true);
    try {
      await this.workspace.actions.updateLevel(record.levelIndex, {
        name,
        uri: record.gmodel.$id,
        version: record.gmodel.version,
      });
      this.handleCancelRename(restoreFocus);
    } catch (error: unknown) {
      this.projects.reportError(error);
    } finally {
      this.savingName.set(false);
    }
  }

  protected handleCancelRename(restoreFocus: boolean = false): void {
    const id: string | null = this.editingId();
    this.editingId.set(null);
    if (!restoreFocus) return;

    afterNextRender(
      (): void => {
        const buttons: NodeListOf<HTMLButtonElement> = this.element.nativeElement.querySelectorAll('button[data-level-id]');
        [...buttons].find((button: HTMLButtonElement): boolean => button.dataset['levelId'] === id)?.focus();
      },
      { injector: this.injector },
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
    this.dialogs.open(CreateModelDialog, { headerKey: 'editor.createLevel', width: '30rem' });
  }

  protected handleEdit(record: ModelRecord): void {
    this.dialogs.open(CreateModelDialog, {
      headerKey: 'editor.editLevel',
      width: '30rem',
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
