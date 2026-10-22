import { ChangeDetectionStrategy, Component, inject, input, type InputSignal, type OnInit } from '@angular/core';
import { FormsModule, type NgForm } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideSave, LucideX } from '@lucide/angular';
import { Button, Input } from '@sushi-kit/angular';
import { type Manifest, type UpdateManifest } from '../../../../models/Manifest';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { ProjectService } from '../../../../services/projects/project.service';
import { isDescriptionValid } from '../../../../utils/descriptions';
import { DescriptionFieldComponent } from '../../shared/description-field/description-field.component';

@Component({
  selector: 'nori-project-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideSave, LucideX, FormsModule, TranslocoDirective, Button, Input, DescriptionFieldComponent],
  templateUrl: './project-edit.dialog.html',
  styleUrl: './project-edit.dialog.scss',
})
export class ProjectEditDialog implements OnInit {
  private readonly projects: ProjectService = inject(ProjectService);
  protected readonly dialogs: DialogService = inject(DialogService);

  public readonly project: InputSignal<Manifest> = input.required();

  protected draft: UpdateManifest = { name: '', description: '' };

  public ngOnInit(): void {
    this.draft = { name: this.project().name, description: this.project().description };
  }

  protected isDescriptionValid(): boolean {
    return isDescriptionValid(this.draft.description);
  }

  protected hasChanges(): boolean {
    const project: Manifest = this.project();
    return this.draft.name.trim() !== project.name || this.draft.description.trim() !== project.description;
  }

  protected async handleSave(form: NgForm): Promise<void> {
    const draft: UpdateManifest = this.draft;
    if (form.invalid || draft.name.trim().length < 3 || !this.isDescriptionValid() || !this.hasChanges()) return;
    await this.dialogs.run(
      (): Promise<void> =>
        this.projects.updateProject(this.project().projectId, {
          name: draft.name.trim(),
          description: draft.description.trim(),
        }),
    );
  }
}
