import { Component, effect, inject, model, ModelSignal, signal, WritableSignal } from '@angular/core';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { Fieldset } from 'primeng/fieldset';
import { IftaLabel } from 'primeng/iftalabel';
import { Message } from 'primeng/message';
import { FormsModule } from '@angular/forms';
import { Textarea } from 'primeng/textarea';
import { REGEXP } from '../../../../core/const/REGEXP';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { CreateSlotInput } from '../../../../services/workspace/workspace.actions';
import { ActivatedRoute } from '@angular/router';
import { NavigationService } from '../../../../services/navigation.service';
import { ModelRecord } from '../../../../models/ModelRecord';
import { StorageService } from '../../../../services/storage.service';

@Component({
  selector: 'app-modal-create-model',
  imports: [InputText, Button, Fieldset, IftaLabel, Message, Textarea, FormsModule],
  templateUrl: './create-model.dialog.html',
  styleUrl: './create-model.dialog.scss',
})
export class CreateModelDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly dialogRef: DynamicDialogRef = inject(DynamicDialogRef);

  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly navigation: NavigationService = inject(NavigationService);

  public workingSlot: ModelSignal<number | undefined> = model();
  public workingModel: WritableSignal<CreateSlotInput> = signal({
    name: '',
    description: '',
    version: '1.0.0',
    uri: 'https://example.com/',
  });

  protected isSubmitted: boolean = false;

  constructor() {
    effect((): void => {
      const workingSlot: number | undefined = this.workingSlot();
      if (!workingSlot) return;

      const existing: ModelRecord | undefined = this.storage.recordsBySlot().get(workingSlot);
      if (!existing) return this.workingSlot.set(undefined);

      const input: CreateSlotInput = {
        name: existing.name,
        description: existing.description,
        uri: existing.gmodel.$id,
        version: existing.gmodel.version,
      };
      this.workingModel.set(input);
    });
  }

  protected isModelNameValid(): boolean {
    const modelName: string = this.workingModel.name.trim();
    return modelName !== '' && modelName.length >= 3;
  }

  protected isVersionValid(): boolean {
    const version: string = this.workingModel().version.trim();
    return version !== '' && REGEXP.isSemanticVersion.test(version);
  }

  protected isUriValid(): boolean {
    const uri: string = this.workingModel().uri.trim();
    return uri !== '' && REGEXP.isValidURI.test(uri);
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

    const createdSlot: number = await this.workspace.actions.createSlot(this.workingModel());
    void this.navigation.navigateToSlot(this.activatedRoute, createdSlot);
    this.dialogRef.close();
  }

  public async handleUpdateModel(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    const workingSlot: number | undefined = this.workingSlot();
    if (!workingSlot) return;

    void this.workspace.actions.updateSlot(workingSlot, this.workingModel());
    this.dialogRef.close();
  }
}
