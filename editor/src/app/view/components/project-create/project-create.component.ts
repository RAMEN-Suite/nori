import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  input,
  output,
  type InputSignal,
  type OutputEmitterRef,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Input, Textarea, Button, Checkbox, Message, Card } from '@sushi-kit/angular';

import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucidePlus } from '@lucide/angular';

import { CATALOG, EXAMPLES } from '../../../../data/CATALOG';
import { RAMEN_MODEL } from '@ramen-suite/core/ramen';
import { Model } from '@ramen-suite/core/model';
import { CreateManifest, StorageService } from '../../../services/storage.service';
import { Manifest } from '../../../models/Manifest';
import { NavigationService } from '../../../services/navigation.service';
import { ProjectAlternativeComponent } from '../project-alternative/project-alternative.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-project-create',
  imports: [
    ProjectAlternativeComponent,
    FormsModule,
    Input,
    Textarea,
    Button,
    Checkbox,
    Message,
    Card,
    TranslocoDirective,
    LucidePlus,
  ],
  templateUrl: './project-create.component.html',
  styleUrl: '../../pages/project-entry.scss',
})
export class ProjectCreateComponent {
  private readonly translations: TranslocoService = inject(TranslocoService);

  protected readonly storage: StorageService = inject(StorageService);
  protected readonly navigation: NavigationService = inject(NavigationService);

  public readonly alternativeVisible: InputSignal<boolean> = input(true);
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly showAlternative: OutputEmitterRef<void> = output();
  public readonly busyChange: OutputEmitterRef<boolean> = output<boolean>();

  protected readonly manifest: CreateManifest = {
    name: '',
    description: '',
    metamodelName: '',
    metamodelId: '',
    metamodelVersion: '',
  };
  protected readonly metamodels: readonly Model[] = CATALOG;
  protected selectedMetamodel: Model = RAMEN_MODEL;
  protected readonly pending: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);

  protected isCreatingExample: boolean = false;

  protected isProjectNameValid(): boolean {
    return this.manifest.name.trim().length >= 3;
  }

  protected isMetamodelValid(): boolean {
    const model: Model = this.selectedMetamodel;
    return this.metamodels.some((m: Model): boolean => m.id === model.id && m.version === model.version);
  }

  protected isFormValid(): boolean {
    return this.isProjectNameValid() && this.isMetamodelValid();
  }

  protected async handleCreateProject(): Promise<void> {
    if (!this.isFormValid() || this.pending() || this.disabled()) return;

    this.manifest.name = this.manifest.name.trim();
    this.manifest.description = this.manifest.description.trim();

    const { id, version, name } = this.selectedMetamodel;
    this.manifest.metamodelId = id;
    this.manifest.metamodelVersion = version;
    this.manifest.metamodelName = name;

    const example: Model | undefined = this.isCreatingExample ? EXAMPLES.at(0) : undefined;

    this.pending.set(true);
    this.busyChange.emit(true);
    this.error.set(null);
    try {
      const manifest: Manifest = await this.storage.createProject(this.manifest, this.selectedMetamodel, example);
      await this.navigation.navigateToProject(manifest.projectId);
    } catch {
      this.error.set(this.translations.translate('create.error'));
    } finally {
      this.pending.set(false);
      this.busyChange.emit(false);
    }
  }
}
