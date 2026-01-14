import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { CreateModelInput, WorkspaceService } from '../../../services/workspace.service';
import { Fieldset } from 'primeng/fieldset';
import { IftaLabel } from 'primeng/iftalabel';
import { Message } from 'primeng/message';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Textarea } from 'primeng/textarea';
import { WorkspaceState } from '../../../states/workspace.state';
import { REGEXP } from '../../../const/REGEXP';
import { SuggestionHelper } from '../../../core/validation/helper/SuggestionHelper';

@Component({
  selector: 'app-modal-create-model',
  imports: [
    Dialog,
    InputText,
    Button,
    Fieldset,
    IftaLabel,
    Message,
    ReactiveFormsModule,
    Textarea,
    FormsModule,
  ],
  templateUrl: './create-model.modal.html',
  styleUrl: './create-model.modal.scss',
})
export class CreateModelModal {
  @Input() isVisible: boolean = false;
  @Output() closeCreateModal: EventEmitter<void> = new EventEmitter();

  protected workspaceState: WorkspaceState = inject(WorkspaceState);
  protected workspace: WorkspaceService = inject(WorkspaceService);

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
    const uri: string = this.newModel.uri;
    return uri !== '' && REGEXP.isValidURITemplate.test(uri);
  }

  protected isFormValid(): boolean {
    return this.isModelNameValid() && this.isVersionValid() && this.isUriValid();
  }

  public handleCloseModal(): void {
    this.closeCreateModal.emit();
  }

  public async handleCreateModel(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    this.newModel.slug = SuggestionHelper.createIdentifier(this.newModel.name);

    if (this.workspaceState.state().isDirty) {
      await this.workspace.saveDraftToActiveSlot();
    }

    await this.workspace.createModel(this.newModel);
    this.closeCreateModal.emit();
  }
}
