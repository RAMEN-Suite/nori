import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { WindowState } from '../../states/window.state';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Fieldset } from 'primeng/fieldset';
import { Textarea } from 'primeng/textarea';
import { IftaLabel } from 'primeng/iftalabel';
import { InputGroup } from 'primeng/inputgroup';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';
import { Router, RouterLink } from '@angular/router';
import ShortUniqueId from 'short-unique-id';
import { Manifest } from '../../models/Manifest';
import { Nullable } from '../../../global';
import { Message } from 'primeng/message';
import { CATALOG } from '../../data/CATALOG';
import { environment } from '../../../environments/environment';
import { GModel } from '../../models/GModel';
import { PlatformAdapter } from '../../adapter/platforms/PlatformAdapter';
import { PLATFORM } from '../../tokens/platform.token';

@Component({
  selector: 'app-create',
  imports: [
    FormsModule,
    InputText,
    Fieldset,
    Textarea,
    IftaLabel,
    InputGroup,
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
  private readonly cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private readonly router: Router = inject(Router);

  protected readonly platformAdapter: PlatformAdapter = inject(PLATFORM);
  protected readonly manifest: Manifest;
  protected readonly metamodels: GModel[] = CATALOG;

  protected isCreatingExamples: boolean = false;
  protected isProjectLocationValid: boolean = true;
  protected isSubmitted: boolean = false;

  constructor() {
    this.manifest = {
      name: '',
      description: '',
      location: '',
      manifestVersion: environment.manifestVersion,
      appVersion: environment.appVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectId: new ShortUniqueId({ length: 16 }).randomUUID(),
      metamodelId: CATALOG[0].id,
    };
  }

  public async ngOnInit(): Promise<void> {
    this.windowState.setTitle('Create Project', 'pi pi-folder-plus');
  }

  protected isProjectNameValid(): boolean {
    const projectName: string = this.manifest.name.trim();
    return projectName !== '' && projectName.length >= 3;
  }

  protected isMetamodelValid(): boolean {
    const metamodelIds: string[] = this.metamodels.map((m: GModel): string => m.id);
    return metamodelIds.includes(this.manifest.metamodelId);
  }

  protected isFormValid(): boolean {
    const projectLocation: Nullable<string> = this.manifest.location?.trim();
    const hasWorkspace: boolean = !this.platformAdapter.hasFilesystem || projectLocation !== '';

    return hasWorkspace && this.isProjectNameValid() && this.isMetamodelValid();
  }

  protected async validateProjectLocation(): Promise<void> {
    if (!this.platformAdapter.hasFilesystem) return;

    const location: string = this.manifest.location?.trim() ?? '';
    this.isProjectLocationValid = await this.platformAdapter.isProjectLocationValid(location);
    this.cdr.markForCheck();
  }

  protected async handleProjectLocation(): Promise<void> {
    const location: Nullable<string> = await this.platformAdapter.chooseProjectLocation();
    if (!location || location === '') return;

    this.manifest.location = location;
    await this.validateProjectLocation();
  }

  protected async handleCreateProject(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    if (this.platformAdapter.hasFilesystem) {
      await this.validateProjectLocation();
      if (!this.isProjectLocationValid) return;
    }

    await this.platformAdapter.saveManifest(this.manifest);
    await this.router.navigate(['/ws', this.manifest.projectId]);
  }
}
