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
import { Button, Input, Message } from '@sushi-kit/angular';
import { type ModelRecord } from '../../../../models/ModelRecord';
import { DialogService } from '../../../../services/dialog.service';
import { NavigationService } from '../../../../services/navigation.service';
import { StorageService } from '../../../../services/storage.service';
import { type CreateSlotInput } from '../../../../services/workspace/workspace.actions';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-modal-create-model',
  imports: [LucidePlus, LucideSave, LucideX, TranslocoDirective, Input, Button, Message, FormsModule],
  templateUrl: './create-model.dialog.html',
})
export class CreateModelDialog {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly storage: StorageService = inject(StorageService);
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly navigation: NavigationService = inject(NavigationService);

  public readonly currentSlot: ModelSignal<number | undefined> = model();

  protected isSubmitted: boolean = false;
  protected readonly draftModel: WritableSignal<CreateSlotInput> = signal({
    name: '',
    version: '1.0.0',
    uri: 'https://example.com/',
  });

  protected readonly parentName: Signal<string> = computed(
    (): string => this.workspace.store.getCreationParent()?.getModel().name ?? RAMEN_MODEL.name,
  );

  public constructor() {
    effect((): void => {
      const currentSlot: number | undefined = this.currentSlot();
      if (!currentSlot) return;

      const existing: ModelRecord | undefined = this.storage.recordsBySlot().get(currentSlot);
      if (!existing) return this.currentSlot.set(undefined);

      const input: CreateSlotInput = {
        name: existing.name,
        uri: existing.gmodel.$id,
        version: existing.gmodel.version,
      };
      this.draftModel.set(input);
    });
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
    return this.isModelNameValid() && this.isVersionValid() && this.isUriValid();
  }

  protected handleCloseModal(): void {
    this.dialogs.close();
  }

  protected async handleCreateModel(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    await this.dialogs.run(async (): Promise<void> => {
      const createdSlot: number = await this.workspace.actions.createSlot(this.draftModel());
      await this.navigation.navigateToSlot(createdSlot);
    });
  }

  protected async handleUpdateModel(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    const currentSlot: number | undefined = this.currentSlot();
    if (!currentSlot) return;

    await this.dialogs.run(async (): Promise<void> => {
      await this.workspace.actions.updateSlot(currentSlot, this.draftModel());
    });
  }
}
