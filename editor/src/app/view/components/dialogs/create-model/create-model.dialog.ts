import { Component, effect, inject, model, ModelSignal, signal, WritableSignal } from '@angular/core';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { Fieldset } from 'primeng/fieldset';
import { IftaLabel } from 'primeng/iftalabel';
import { Message } from 'primeng/message';
import { FormsModule } from '@angular/forms';
import { REGEXP } from '../../../../core/const/REGEXP';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { CreateSlotInput } from '../../../../services/workspace/workspace.actions';
import { ActivatedRoute } from '@angular/router';
import { NavigationService } from '../../../../services/navigation.service';
import { ModelRecord } from '../../../../models/ModelRecord';
import { StorageService } from '../../../../services/storage.service';

@Component({
  selector: 'app-modal-create-model',
  imports: [InputText, Button, Fieldset, IftaLabel, Message, FormsModule],
  templateUrl: './create-model.dialog.html',
  styleUrl: './create-model.dialog.scss',
})
export class CreateModelDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly dialogRef: DynamicDialogRef = inject(DynamicDialogRef);

  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly navigation: NavigationService = inject(NavigationService);

  protected isSubmitted: boolean = false;

  public currentSlot: ModelSignal<number | undefined> = model();
  protected draftModel: WritableSignal<CreateSlotInput> = signal({
    name: '',
    description: '',
    version: '1.0.0',
    uri: 'https://example.com/',
  });

  constructor() {
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
    return version !== '' && REGEXP.SEMANTIC_VER.test(version);
  }

  protected isUriValid(): boolean {
    const uri: string = this.draftModel().uri.trim();
    return uri !== '' && REGEXP.VALID_URI.test(uri);
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

    const createdSlot: number = await this.workspace.actions.createSlot(this.draftModel());
    void this.navigation.navigateToSlot(this.activatedRoute, createdSlot);
    this.dialogRef.close();
  }

  public async handleUpdateModel(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    const currentSlot: number | undefined = this.currentSlot();
    if (!currentSlot) return;

    void this.workspace.actions.updateSlot(currentSlot, this.draftModel());
    this.dialogRef.close();
  }
}
