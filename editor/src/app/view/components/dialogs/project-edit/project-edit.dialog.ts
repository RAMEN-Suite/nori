import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
  type WritableSignal,
  type InputSignal,
  type OnInit,
} from '@angular/core';
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
})
export class ProjectEditDialog implements OnInit {
  private readonly projects: ProjectService = inject(ProjectService);
  protected readonly dialogs: DialogService = inject(DialogService);

  public readonly project: InputSignal<Manifest> = input.required();

  protected readonly name: WritableSignal<string> = signal('');
  protected readonly description: WritableSignal<string> = signal('');

  public ngOnInit(): void {
    this.name.set(this.project().name);
    this.description.set(this.project().description);
  }

  protected isDescriptionValid(): boolean {
    return isDescriptionValid(this.description());
  }

  protected hasChanges(): boolean {
    const project: Manifest = this.project();
    return this.name().trim() !== project.name || this.description().trim() !== project.description;
  }

  protected async handleSave(form: NgForm): Promise<void> {
    const draft: UpdateManifest = { name: this.name(), description: this.description() };
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
