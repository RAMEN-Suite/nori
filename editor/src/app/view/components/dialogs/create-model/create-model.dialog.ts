import { Component, effect, inject, model, ModelSignal, signal, WritableSignal, ChangeDetectionStrategy } from '@angular/core';
import { Input, Button, Fieldset, FieldsetLegend, Message } from '@sushi-kit/angular';

import { WorkspaceService } from '../../../../services/workspace/workspace.service';

import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../../services/dialog.service';
import { CreateSlotInput } from '../../../../services/workspace/workspace.actions';
import { NavigationService } from '../../../../services/navigation.service';
import { ModelRecord } from '../../../../models/ModelRecord';
import { StorageService } from '../../../../services/storage.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-modal-create-model',
  imports: [Input, Button, Fieldset, FieldsetLegend, Message, FormsModule],
  templateUrl: './create-model.dialog.html',
  styleUrl: './create-model.dialog.scss',
})
export class CreateModelDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly dialogRef: DialogService = inject(DialogService);

  protected readonly navigation: NavigationService = inject(NavigationService);

  protected isSubmitted: boolean = false;

  public readonly currentSlot: ModelSignal<number | undefined> = model();
  protected readonly draftModel: WritableSignal<CreateSlotInput> = signal({
    name: '',
    version: '1.0.0',
    uri: 'https://example.com/',
  });

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
    return modelName !== '' && modelName.length >= 3;
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

  public handleCloseModal(): void {
    this.dialogRef.close();
  }

  public async handleCreateModel(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    await this.dialogRef.run(async (): Promise<void> => {
      const createdSlot: number = await this.workspace.actions.createSlot(this.draftModel());
      await this.navigation.navigateToSlot(createdSlot);
    });
  }

  public async handleUpdateModel(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    const currentSlot: number | undefined = this.currentSlot();
    if (!currentSlot) return;

    await this.dialogRef.run(async (): Promise<void> => {
      await this.workspace.actions.updateSlot(currentSlot, this.draftModel());
    });
  }
}
