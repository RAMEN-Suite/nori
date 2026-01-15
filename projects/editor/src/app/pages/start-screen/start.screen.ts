import { Component, inject, OnInit } from '@angular/core';
import { WindowState } from '../../states/window.state';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Fieldset } from 'primeng/fieldset';
import { Textarea } from 'primeng/textarea';
import { IftaLabel } from 'primeng/iftalabel';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';
import { Router, RouterLink } from '@angular/router';
import { Message } from 'primeng/message';
import { CATALOG, EXAMPLES } from '../../../data/CATALOG';
import { GModel } from '../../models/GModel';
import { CreateManifest, StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-create',
  imports: [
    FormsModule,
    InputText,
    Fieldset,
    Textarea,
    IftaLabel,
    Button,
    Select,
    Checkbox,
    RouterLink,
    Message,
  ],
  templateUrl: './start.screen.html',
  styleUrl: './start.screen.scss',
})
export class StartScreen implements OnInit {
  private readonly windowState: WindowState = inject(WindowState);
  private readonly storage: StorageService = inject(StorageService);
  private readonly router: Router = inject(Router);

  protected readonly manifest: CreateManifest;
  protected readonly metamodels: GModel[] = CATALOG;

  protected selectedMetamodel: GModel;
  protected isCreatingExample: boolean = false;
  protected isSubmitted: boolean = false;

  constructor() {
    this.manifest = { name: '', description: '', metamodelId: '', metaVersion: '' };
    this.selectedMetamodel = CATALOG[0];
  }

  public async ngOnInit(): Promise<void> {
    this.windowState.setTitle('Create Project', 'pi pi-folder-plus');
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

    this.manifest.metamodelId = this.selectedMetamodel.id;
    this.manifest.metaVersion = this.selectedMetamodel.version;

    await this.storage.createProject(
      this.manifest,
      this.selectedMetamodel,
      this.isCreatingExample ? EXAMPLES[0] : undefined,
    );
    await this.router.navigate(['/ws', this.storage.selectedProjectId()]);
  }
}
