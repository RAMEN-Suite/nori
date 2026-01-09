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
import { RouterLink } from '@angular/router';
import ShortUniqueId from 'short-unique-id';
import { Manifest } from '../../models/Manifest';
import { MetamodelService } from '../../services/metamodel.service';
import { ElectronService } from '../../services/electron.service';
import { Nullable } from '../../../global';
import { Message } from 'primeng/message';

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
  private readonly electronService: ElectronService = inject(ElectronService);
  private readonly changeDetectorRef: ChangeDetectorRef = inject(ChangeDetectorRef);

  protected readonly metamodelService: MetamodelService = inject(MetamodelService);
  protected readonly isElectronRuntime: boolean = !!window.electron;

  protected manifest: Partial<Manifest> = {};
  protected isExampleNeeded: boolean = false;
  protected isLocationInvalid: boolean = false;

  public async ngOnInit(): Promise<void> {
    this.windowState.setTitle('Create Project', 'pi pi-folder-plus');
    this.manifest = { name: '', description: '', location: '' };
    this.manifest.projectId = new ShortUniqueId({ length: 16 }).randomUUID();
    this.manifest.metamodelId = this.metamodelService.metamodels()[0].id;
  }

  protected isFormCompleted(): boolean {
    const hasWorkspace: boolean = !this.isElectronRuntime || this.manifest.location?.trim() !== '';
    const hasProjectName: boolean = this.manifest.name?.trim() !== '';
    const hasMetamodel: boolean = this.manifest.metamodelId !== '';
    return hasWorkspace && hasProjectName && hasMetamodel;
  }

  protected async handleLocationAccessibility(): Promise<void> {
    const location: string = this.manifest.location?.trim() ?? '';
    this.isLocationInvalid = await this.electronService.accessLocation(location);
  }

  protected async handleProjectLocation(): Promise<void> {
    const location: Nullable<string> = await this.electronService.openDirectory();
    if (!location || location === '') return;
    this.manifest.location = location;
    this.changeDetectorRef.markForCheck();
  }

  protected async handleProjectCreation(): Promise<void> {
    await this.handleLocationAccessibility();
    if (!this.isLocationInvalid) return;
    if (!this.isFormCompleted()) return;
  }
}
