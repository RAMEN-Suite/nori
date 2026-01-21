import { Component, inject } from '@angular/core';
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

@Component({
  selector: 'app-modal-create-model',
  imports: [InputText, Button, Fieldset, IftaLabel, Message, Textarea, FormsModule],
  templateUrl: './create-model.dialog.html',
  styleUrl: './create-model.dialog.scss',
})
export class CreateModelDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly dialogRef: DynamicDialogRef = inject(DynamicDialogRef);

  protected newModel: CreateSlotInput;
  protected isSubmitted: boolean = false;

  constructor() {
    this.newModel = {
      name: '',
      description: '',
      version: '1.0.0',
      uri: 'https://example.com/',
    };
  }

  protected isModelNameValid(): boolean {
    const modelName: string = this.newModel.name.trim();
    return modelName !== '' && modelName.length >= 3;
  }

  protected isVersionValid(): boolean {
    const version: string = this.newModel.version.trim();
    return version !== '' && REGEXP.isSemanticVersion.test(version);
  }

  protected isUriValid(): boolean {
    const uri: string = this.newModel.uri.trim();
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

    await this.workspace.actions.createSlot(this.newModel);
    this.dialogRef.close();
  }
}
