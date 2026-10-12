import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  type InputSignal,
  type OnInit,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCopy, LucideFolderOpen, LucideSearch, LucideTrash } from '@lucide/angular';
import { Button, Card, Input, List, ListItemTemplate, Message, Tooltip } from '@sushi-kit/angular';
import { type Manifest } from '../../../models/Manifest';
import { DialogService, type DialogRef } from '../../../services/dialog.service';
import { NavigationService } from '../../../services/navigation.service';
import { StorageService } from '../../../services/storage.service';
import { ConfirmationDialog, type ConfirmationOptions } from '../dialogs/confirmation/confirmation.dialog';
import { ProjectAlternativeComponent } from '../project-alternative/project-alternative.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-project-open',
  imports: [
    FormsModule,
    DatePipe,
    TranslocoDirective,
    Button,
    Card,
    Input,
    List,
    ListItemTemplate,
    Message,
    Tooltip,
    LucideCopy,
    LucideFolderOpen,
    LucideSearch,
    LucideTrash,
    ProjectAlternativeComponent,
  ],
  templateUrl: './project-open.component.html',
  styleUrls: ['../../pages/entry-shell.scss', '../../pages/project-entry.scss', './project-open.component.scss'],
})
export class ProjectOpenComponent implements OnInit {
  private readonly storage: StorageService = inject(StorageService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  public readonly alternativeVisible: InputSignal<boolean> = input(true);
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly showAlternative: OutputEmitterRef<void> = output();
  public readonly busyChange: OutputEmitterRef<boolean> = output<boolean>();

  private dialogRef: DialogRef | null = null;
  protected readonly query: WritableSignal<string> = signal('');
  protected readonly loading: WritableSignal<boolean> = signal(true);
  protected readonly busy: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly hasSavedProjects: Signal<boolean> = computed((): boolean => this.storage.manifests().length > 0);
  protected readonly projects: Signal<readonly Manifest[]> = computed((): readonly Manifest[] => {
    const query: string = this.query().trim().toLocaleLowerCase();
    return this.storage
      .manifests()
      .filter((project: Manifest): boolean => `${project.name} ${project.description}`.toLocaleLowerCase().includes(query));
  });
  protected readonly trackProject: (index: number, project: Manifest) => string = (_index: number, project: Manifest): string =>
    project.projectId;

  public constructor() {
    inject(DestroyRef).onDestroy((): void => this.dialogRef?.close());
  }

  public ngOnInit(): void {
    void this.loadProjects();
  }

  protected async handleOpenProject(projectId: string): Promise<void> {
    await this.runProjectAction((): Promise<void> => this.navigation.navigateToProject(projectId), 'open.openError');
  }

  protected async handleDuplicateProject(projectId: string): Promise<void> {
    await this.runProjectAction((): Promise<void> => this.storage.duplicateProject(projectId), 'open.duplicateError');
  }

  protected handleRemoveProject(project: Manifest): void {
    if (this.busy() || this.disabled()) return;

    const options: ConfirmationOptions = {
      title: this.translations.translate('open.removeTitle'),
      message: this.translations.translate('open.removeMessage', { name: project.name }),
      buttons: [
        [
          { label: this.translations.translate('open.cancel'), severity: 'neutral' },
          {
            label: this.translations.translate('open.remove'),
            severity: 'error',
            click: async (): Promise<void> => {
              try {
                await this.storage.removeProject(project.projectId);
              } catch {
                throw new Error(this.translations.translate('open.removeError'));
              }
            },
          },
        ],
      ],
    };
    this.dialogRef = this.dialogs.open(ConfirmationDialog, {
      size: 'compact',
      headerKey: 'open.removeTitle',
      inputValues: { options },
    });
  }

  private async loadProjects(): Promise<void> {
    try {
      await this.storage.refreshManifests();
    } catch {
      this.error.set(this.translations.translate('open.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  private async runProjectAction(action: () => Promise<void>, errorKey: string): Promise<void> {
    if (this.busy() || this.disabled()) return;

    this.busy.set(true);
    this.busyChange.emit(true);
    this.error.set(null);

    try {
      await action();
    } catch {
      this.error.set(this.translations.translate(errorKey));
    } finally {
      this.busy.set(false);
      this.busyChange.emit(false);
    }
  }
}
