import { Component, inject } from '@angular/core';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { CreateModelInput, WorkspaceService } from '../../../../services/workspace.service';
import { Fieldset } from 'primeng/fieldset';
import { IftaLabel } from 'primeng/iftalabel';
import { Message } from 'primeng/message';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Textarea } from 'primeng/textarea';
import { REGEXP } from '../../../../core/const/REGEXP';
import { SuggestionHelper } from '../../../../core/validation/helper/SuggestionHelper';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-modal-create-model',
  imports: [
    InputText,
    Button,
    Fieldset,
    IftaLabel,
    Message,
    ReactiveFormsModule,
    Textarea,
    FormsModule,
  ],
  templateUrl: './create-model.dialog.html',
  styleUrl: './create-model.dialog.scss',
})
export class CreateModelDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly dialogRef: DynamicDialogRef = inject(DynamicDialogRef);

  protected newModel: CreateModelInput;
  protected isSubmitted: boolean = false;

  constructor() {
    this.newModel = {
      name: '',
      description: '',
      version: '1.0.0',
      uri: 'https://example.com/',
      slug: '',
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
    return uri !== '' && REGEXP.isValidURITemplate.test(uri);
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

    try {
      this.newModel.slug = SuggestionHelper.createIdentifier();
      await this.workspace.createModel(this.newModel);
      this.dialogRef.close();
    } catch (error: unknown) {
      console.error(error);
      // TODO: Add error handling
    }
  }
}
