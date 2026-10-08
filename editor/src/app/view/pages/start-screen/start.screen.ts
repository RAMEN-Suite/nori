import { Component, inject, OnInit, ChangeDetectionStrategy, signal, type WritableSignal } from '@angular/core';
import { WindowState } from '../../../states/window.state';
import { FormsModule } from '@angular/forms';
import { Input, Textarea, Button, Checkbox, Message, Card } from '@sushi-kit/angular';

import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideArrowLeft, LucidePlus, LucideSettings } from '@lucide/angular';
import { environment } from '../../../../environments/environment';

import { CATALOG, EXAMPLES } from '../../../../data/CATALOG';
import { RAMEN_MODEL } from '@ramen-suite/core/ramen';
import { Model } from '@ramen-suite/core/model';
import { CreateManifest, StorageService } from '../../../services/storage.service';
import { Manifest } from '../../../models/Manifest';
import { NavigationService } from '../../../services/navigation.service';
import { DialogService } from '../../../services/dialog.service';
import { SettingsDialog } from '../../components/dialogs/settings/settings.dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-create',
  imports: [
    FormsModule,
    Input,
    Textarea,
    Button,
    Checkbox,
    RouterLink,
    Message,
    Card,
    TranslocoDirective,
    LucideArrowLeft,
    LucidePlus,
    LucideSettings,
  ],
  templateUrl: './start.screen.html',
  styleUrl: '../project-entry.scss',
})
export class StartScreen implements OnInit {
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  protected readonly environment: typeof environment = environment;

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
  protected readonly pending: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);

  protected isCreatingExample: boolean = false;

  public ngOnInit(): void {
    this.windowState.setTitleKey('create.windowTitle', 'folder-plus');
  }

  protected handleSettings(): void {
    this.dialogs.open(SettingsDialog, { headerKey: 'common.settings' });
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
    if (!this.isFormValid() || this.pending()) return;

    this.manifest.name = this.manifest.name.trim();
    this.manifest.description = this.manifest.description.trim();

    const { id, version, name } = this.selectedMetamodel;
    this.manifest.metamodelId = id;
    this.manifest.metamodelVersion = version;
    this.manifest.metamodelName = name;

    const example: Model | undefined = this.isCreatingExample ? EXAMPLES.at(0) : undefined;

    this.pending.set(true);
    this.error.set(null);
    try {
      const manifest: Manifest = await this.storage.createProject(this.manifest, this.selectedMetamodel, example);
      await this.navigation.navigateToProject(manifest.projectId);
    } catch {
      this.error.set(this.translations.translate('create.error'));
    } finally {
      this.pending.set(false);
    }
  }
}
