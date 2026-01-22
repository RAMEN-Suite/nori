import { Component, inject } from '@angular/core';
import { WindowState } from '../../../states/window.state';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Fieldset } from 'primeng/fieldset';
import { Textarea } from 'primeng/textarea';
import { IftaLabel } from 'primeng/iftalabel';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';
import { RouterLink } from '@angular/router';
import { Message } from 'primeng/message';
import { CATALOG, EXAMPLES } from '../../../../data/CATALOG';
import { GModel } from '../../../core/models/GModel';
import { CreateManifest, StorageService } from '../../../services/storage.service';
import { Manifest } from '../../../models/Manifest';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  selector: 'app-create',
  imports: [FormsModule, InputText, Fieldset, Textarea, IftaLabel, Button, Select, Checkbox, RouterLink, Message],
  templateUrl: './start.screen.html',
  styleUrl: './start.screen.scss',
})
export class StartScreen {
  protected readonly windowState: WindowState = inject(WindowState);
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly navigation: NavigationService = inject(NavigationService);

  protected readonly manifest: CreateManifest;
  protected readonly metamodels: GModel[] = CATALOG;

  protected selectedMetamodel: GModel;
  protected isCreatingExample: boolean = false;
  protected isSubmitted: boolean = false;

  constructor() {
    this.windowState.setTitle('Create Project', 'pi pi-folder-plus');
    this.manifest = {
      name: '',
      description: '',
      metamodelName: '',
      metamodelId: '',
      metamodelVersion: '',
    };
    this.selectedMetamodel = CATALOG[0];
  }

  protected isProjectNameValid(): boolean {
    const projectName: string = this.manifest.name.trim();
    return projectName !== '' && projectName.length >= 3;
  }

  protected isMetamodelValid(): boolean {
    return !!this.metamodels.find((m: GModel): boolean => {
      const hasSameVersion: boolean = m.version === this.selectedMetamodel.version;
      const hasSameIdentifier: boolean = m.id === this.selectedMetamodel.id;
      return hasSameVersion && hasSameIdentifier;
    });
  }

  protected isFormValid(): boolean {
    return this.isProjectNameValid() && this.isMetamodelValid();
  }

  protected async handleCreateProject(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    const { id, version, name } = this.selectedMetamodel;
    this.manifest.metamodelId = id;
    this.manifest.metamodelVersion = version;
    this.manifest.metamodelName = name;

    const example: GModel | undefined = this.isCreatingExample ? EXAMPLES[0] : undefined;
    const manifest: Manifest = await this.storage.createProject(this.manifest, this.selectedMetamodel, example);
    void this.navigation.navigateToProject(manifest.projectId);
  }
}
