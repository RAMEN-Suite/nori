import { Component, inject, OnInit } from '@angular/core';
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
import { GModel } from '@ramen-suite/core/gcore';
import { CreateManifest, StorageService } from '../../../services/storage.service';
import { Manifest } from '../../../models/Manifest';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  selector: 'app-create',
  imports: [FormsModule, InputText, Fieldset, Textarea, IftaLabel, Button, Select, Checkbox, RouterLink, Message],
  templateUrl: './start.screen.html',
  styleUrl: './start.screen.scss',
})
export class StartScreen implements OnInit {
  protected readonly windowState: WindowState = inject(WindowState);
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly navigation: NavigationService = inject(NavigationService);

  protected readonly manifest: CreateManifest = {
    name: '',
    description: '',
    metamodelName: '',
    metamodelId: '',
    metamodelVersion: '',
  };
  protected readonly metamodels: GModel[] = CATALOG;
  protected selectedMetamodel: GModel = CATALOG[0];

  protected isCreatingExample: boolean = false;
  protected isSubmitted: boolean = false;

  public ngOnInit(): void {
    this.windowState.setTitle('Create Project', 'pi pi-folder-plus');
  }

  protected isProjectNameValid(): boolean {
    return this.manifest.name.trim().length >= 3;
  }

  protected isMetamodelValid(): boolean {
    const model: GModel = this.selectedMetamodel;
    return this.metamodels.some((m: GModel): boolean => m.id === model.id && m.version === model.version);
  }

  protected isFormValid(): boolean {
    return this.isProjectNameValid() && this.isMetamodelValid();
  }

  protected async handleCreateProject(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    this.manifest.name = this.manifest.name.trim();
    this.manifest.description = this.manifest.description?.trim?.() ?? this.manifest.description;

    const { id, version, name } = this.selectedMetamodel;
    this.manifest.metamodelId = id;
    this.manifest.metamodelVersion = version;
    this.manifest.metamodelName = name;

    const example: GModel | undefined = this.isCreatingExample ? EXAMPLES.at(0) : undefined;

    const manifest: Manifest = await this.storage.createProject(this.manifest, this.selectedMetamodel, example);
    void this.navigation.navigateToProject(manifest.projectId);
  }
}
