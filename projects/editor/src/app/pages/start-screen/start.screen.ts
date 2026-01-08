import { Component, inject, OnInit } from '@angular/core';
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
import { IManifest } from '../../interfaces/IManifest';
import ShortUniqueId from 'short-unique-id';

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
  ],
  templateUrl: './start.screen.html',
  styleUrl: './start.screen.scss',
})
export class StartScreen implements OnInit {
  private readonly windowState: WindowState = inject(WindowState);
  protected readonly isElectronRuntime: boolean = !!window.electron;

  protected manifest: Partial<IManifest> = {};
  protected isExampleNeeded: boolean = false;

  public ngOnInit(): void {
    this.windowState.setTitle('Create Project', 'pi pi-folder-plus');
    this.manifest = { name: '', description: '', location: '' };
    this.manifest.projectId = new ShortUniqueId({ length: 12 }).rnd();
  }

  protected isFormCompleted(): boolean {
    const hasWorkspace: boolean = !this.isElectronRuntime || this.manifest.location?.trim() !== '';
    const hasProjectName: boolean = this.manifest.name?.trim() !== '';
    return hasWorkspace && hasProjectName;
  }
}
