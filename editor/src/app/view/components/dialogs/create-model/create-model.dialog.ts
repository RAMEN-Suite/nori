import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  type ModelSignal,
  signal,
  type WritableSignal,
  type Signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePlus, LucideSave, LucideX } from '@lucide/angular';
import { RAMEN_MODEL } from '@ramen-suite/core/ramen';
import { Button, Input } from '@sushi-kit/angular';
import { isDescriptionValid } from '../../../../utils/descriptions';
import { DescriptionFieldComponent } from '../../shared/description-field/description-field.component';
import { type ModelRecord } from '../../../../models/ModelRecord';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { NavigationService } from '../../../../services/interaction/navigation.service';
import { ProjectService } from '../../../../services/projects/project.service';
import { type CreateLevelInput } from '../../../../services/workspace/model/workspace-actions.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-create-model-dialog',
  imports: [DescriptionFieldComponent, LucidePlus, LucideSave, LucideX, TranslocoDirective, Input, Button, FormsModule],
  templateUrl: './create-model.dialog.html',
})
export class CreateModelDialog {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly projects: ProjectService = inject(ProjectService);
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly navigation: NavigationService = inject(NavigationService);

  public readonly currentLevelIndex: ModelSignal<number | undefined> = model();

  protected readonly isSubmitted: WritableSignal<boolean> = signal(false);
  protected readonly draftModel: WritableSignal<CreateLevelInput> = signal({
    name: '',
    description: '',
    version: '1.0.0',
    uri: 'https://example.com/',
  });

  protected readonly parentName: Signal<string> = computed(
    (): string => this.workspace.store.getCreationParent()?.getModel().name ?? RAMEN_MODEL.name,
  );

  public constructor() {
    effect((): void => {
      const currentLevelIndex: number | undefined = this.currentLevelIndex();
      if (!currentLevelIndex) return;

      const existing: ModelRecord | undefined = this.projects.recordsByLevelIndex().get(currentLevelIndex);
      if (!existing) return this.currentLevelIndex.set(undefined);

      const input: CreateLevelInput = {
        name: existing.name,
        description: existing.gmodel.description ?? '',
        uri: existing.gmodel.$id,
        version: existing.gmodel.version,
      };
      this.draftModel.set(input);
    });
  }

  protected updateDraft(changes: Partial<CreateLevelInput>): void {
    this.draftModel.update((draft: CreateLevelInput): CreateLevelInput => ({ ...draft, ...changes }));
  }

  protected isModelNameValid(): boolean {
    const modelName: string = this.draftModel().name.trim();
    return modelName.length >= 3 && modelName.length <= 70;
  }

  protected isVersionValid(): boolean {
    const version: string = this.draftModel().version.trim();
    return version !== '' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-zA-Z.-]+)?(?:\+[\da-zA-Z.-]+)?$/.test(version);
  }

  protected isUriValid(): boolean {
    const uri: string = this.draftModel().uri.trim();
    return uri !== '' && URL.canParse(uri);
  }

  protected isFormValid(): boolean {
    return (
      isDescriptionValid(this.draftModel().description ?? '') &&
      this.isModelNameValid() &&
      this.isVersionValid() &&
      this.isUriValid()
    );
  }

  protected setDescription(description: string): void {
    this.draftModel.update((draft: CreateLevelInput): CreateLevelInput => ({ ...draft, description }));
  }

  protected handleClose(): void {
    this.dialogs.close();
  }

  protected async handleSave(): Promise<void> {
    this.isSubmitted.set(true);
    if (!this.isFormValid() || this.dialogs.isPending()) return;

    const levelIndex: number | undefined = this.currentLevelIndex();
    await this.dialogs.run(async (): Promise<void> => {
      if (levelIndex !== undefined) {
        await this.workspace.actions.updateLevel(levelIndex, this.draftModel());
      } else {
        const createdLevelIndex: number = await this.workspace.actions.createLevel(this.draftModel());
        await this.navigation.navigateToLevel(createdLevelIndex);
      }
    });
  }
}
