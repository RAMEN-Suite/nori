import { ChangeDetectionStrategy, Component, inject, input, type InputSignal, type OnInit } from '@angular/core';
import { FormsModule, type NgForm } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideSave, LucideX } from '@lucide/angular';
import { Button, Input, Textarea } from '@sushi-kit/angular';
import { type Manifest } from '../../../../models/Manifest';
import { DialogService } from '../../../../services/dialog.service';
import { StorageService, type UpdateManifest } from '../../../../services/storage.service';

@Component({
  selector: 'app-project-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideSave, LucideX, FormsModule, TranslocoDirective, Button, Input, Textarea],
  templateUrl: './project-edit.dialog.html',
})
export class ProjectEditDialog implements OnInit {
  private readonly storage: StorageService = inject(StorageService);
  protected readonly dialogs: DialogService = inject(DialogService);
  public readonly project: InputSignal<Manifest> = input.required();
  protected draft: UpdateManifest = { name: '', description: '' };

  public ngOnInit(): void {
    this.draft = { name: this.project().name, description: this.project().description };
  }

  protected async handleSave(form: NgForm): Promise<void> {
    const draft: UpdateManifest = this.draft;
    if (form.invalid || draft.name.trim().length < 3) return;
    await this.dialogs.run(
      (): Promise<void> =>
        this.storage.updateProject(this.project().projectId, {
          name: draft.name.trim(),
          description: draft.description.trim(),
        }),
    );
  }
}
