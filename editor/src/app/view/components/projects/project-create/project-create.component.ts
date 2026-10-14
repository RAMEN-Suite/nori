import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  type InputSignal,
  type OutputEmitterRef,
  type WritableSignal,
} from '@angular/core';
import { FormsModule, type NgForm } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucidePlus } from '@lucide/angular';
import { type Model } from '@ramen-suite/core/model';
import { RAMEN_MODEL } from '@ramen-suite/core/ramen';
import { Button, Card, Checkbox, Input, Message, Textarea } from '@sushi-kit/angular';
import { createCorrespondenceModel } from '../../../../../data/correspondence';
import { type Manifest, type CreateManifest } from '../../../../models/Manifest';
import { NavigationService } from '../../../../services/interaction/navigation.service';
import { ProjectService } from '../../../../services/projects/project.service';
import { ProjectAlternativeComponent } from '../project-alternative/project-alternative.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-project-create',
  imports: [
    FormsModule,
    TranslocoDirective,
    Button,
    Card,
    Checkbox,
    Input,
    Message,
    Textarea,
    LucidePlus,
    ProjectAlternativeComponent,
  ],
  templateUrl: './project-create.component.html',
  styleUrls: ['../styles/entry-shell.scss', '../styles/project-entry.scss'],
})
export class ProjectCreateComponent {
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly navigation: NavigationService = inject(NavigationService);

  public readonly alternativeVisible: InputSignal<boolean> = input(true);
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly showAlternative: OutputEmitterRef<void> = output();
  public readonly busyChange: OutputEmitterRef<boolean> = output<boolean>();

  protected readonly draft: Pick<CreateManifest, 'name' | 'description'> = { name: '', description: '' };
  protected readonly busy: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected useExample: boolean = false;

  protected isNameValid(): boolean {
    return this.draft.name.trim().length >= 3;
  }

  protected async handleCreateProject(form: NgForm): Promise<void> {
    if (form.invalid || !this.isNameValid() || this.busy() || this.disabled()) return;

    const input: CreateManifest = {
      name: this.draft.name.trim(),
      description: this.draft.description.trim(),
      metamodelName: RAMEN_MODEL.name,
      metamodelId: RAMEN_MODEL.id,
      metamodelVersion: RAMEN_MODEL.version,
    };
    const example: Model | undefined = this.useExample ? createCorrespondenceModel() : undefined;

    this.busy.set(true);
    this.busyChange.emit(true);
    this.error.set(null);

    try {
      const manifest: Manifest = await this.projects.createProject(input, example);
      await this.navigation.navigateToProject(manifest.projectId);
    } catch {
      this.error.set(this.translations.translate('create.error'));
    } finally {
      this.busy.set(false);
      this.busyChange.emit(false);
    }
  }
}
