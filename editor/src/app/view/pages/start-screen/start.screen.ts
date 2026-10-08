import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { WindowState } from '../../../states/window.state';
import { FormsModule } from '@angular/forms';
import { Input, Textarea, Button, Checkbox, Message } from '@sushi-kit/angular';

import { RouterLink } from '@angular/router';

import { CATALOG, EXAMPLES } from '../../../../data/CATALOG';
import { RAMEN_MODEL } from '@ramen-suite/core/ramen';
import { Model } from '@ramen-suite/core/model';
import { CreateManifest, StorageService } from '../../../services/storage.service';
import { Manifest } from '../../../models/Manifest';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-create',
  imports: [FormsModule, Input, Textarea, Button, Checkbox, RouterLink, Message],
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
  protected readonly metamodels: readonly Model[] = CATALOG;
  protected selectedMetamodel: Model = RAMEN_MODEL;
  protected pending: boolean = false;

  protected isCreatingExample: boolean = false;
  protected isSubmitted: boolean = false;

  public ngOnInit(): void {
    this.windowState.setTitle('Create Project');
  }

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
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    this.manifest.name = this.manifest.name.trim();
    this.manifest.description = this.manifest.description.trim();

    const { id, version, name } = this.selectedMetamodel;
    this.manifest.metamodelId = id;
    this.manifest.metamodelVersion = version;
    this.manifest.metamodelName = name;

    const example: Model | undefined = this.isCreatingExample ? EXAMPLES.at(0) : undefined;

    this.pending = true;
    try {
      const manifest: Manifest = await this.storage.createProject(this.manifest, this.selectedMetamodel, example);
      await this.navigation.navigateToProject(manifest.projectId);
    } catch (error: unknown) {
      this.storage.reportError(error);
    } finally {
      this.pending = false;
    }
  }
}
