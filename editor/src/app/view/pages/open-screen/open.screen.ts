import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  Signal,
  signal,
  WritableSignal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { StorageService } from '../../../services/storage.service';
import { WindowState } from '../../../states/window.state';
import { Input, Button } from '@sushi-kit/angular';
import { FormsModule } from '@angular/forms';

import { RouterLink } from '@angular/router';
import { Manifest } from '../../../models/Manifest';
import { DatePipe } from '@angular/common';
import { NavigationService } from '../../../services/navigation.service';
import {
  ConfirmationButton,
  ConfirmationDialog,
  ConfirmationOptions,
} from '../../components/dialogs/confirmation/confirmation.dialog';
import { DialogService, DialogRef } from '../../../services/dialog.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-open-screen',
  imports: [Input, Button, RouterLink, FormsModule, DatePipe],
  templateUrl: './open.screen.html',
  styleUrl: './open.screen.scss',
})
export class OpenScreen implements OnInit {
  protected readonly windowState: WindowState = inject(WindowState);

  protected readonly storage: StorageService = inject(StorageService);
  protected readonly navigation: NavigationService = inject(NavigationService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DialogRef | null = null;

  protected readonly searchInput: WritableSignal<string> = signal('');
  protected readonly filteredManifests: Signal<Manifest[]> = computed((): Manifest[] => {
    const query: string = this.searchInput().trim().toLowerCase();
    const list: Manifest[] = this.storage.manifests();
    if (!query) return list;

    return list.filter((manifest: Manifest): boolean => {
      const isNameIncluding: boolean = manifest.name.toLowerCase().includes(query);
      const isDescriptionIncluding: boolean = manifest.description.toLowerCase().includes(query);
      return isNameIncluding || isDescriptionIncluding;
    });
  });

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  public ngOnInit(): void {
    this.windowState.setTitle('Open Project');
    void this.storage.refreshManifests();
  }

  protected handleOpenProject(projectId: string): void {
    void this.navigation.navigateToProject(projectId);
  }

  protected handleDeleteProject(manifest: Manifest): void {
    const acceptButton: ConfirmationButton = {
      label: 'Remove project',
      size: 'sm',
      severity: 'error',
      variant: 'outlined',
      click: async (): Promise<void> => {
        await this.storage.removeProject(manifest.projectId);
      },
    };
    const cancelButton: ConfirmationButton = {
      label: `Cancel`,
      size: 'sm',
      variant: 'outlined',
      click: (): void => this.dialogRef?.close(),
    };

    const options: ConfirmationOptions = {
      title: 'Deleting Project',
      message: `Do you really want to delete <span class="font-bold font-stretch-semi-expanded">${manifest.name}</span>? <br />
      Once deleted, it is gone forever.`,

      justify: 'justify-around',
      buttons: [[cancelButton], [acceptButton]],
    };

    this.dialogRef = this.dialogService.open(ConfirmationDialog, {
      inputValues: { options },
    });
  }

  protected async handleDuplicateProject(manifest: Manifest): Promise<void> {
    try {
      await this.storage.duplicateProject(manifest.projectId);
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }
}
