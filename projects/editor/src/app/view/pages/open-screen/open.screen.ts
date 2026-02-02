import { Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal } from '@angular/core';
import { StorageService } from '../../../services/storage.service';
import { WindowState } from '../../../states/window.state';
import { InputText } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { RouterLink } from '@angular/router';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddon } from 'primeng/inputgroupaddon';
import { Fieldset } from 'primeng/fieldset';
import { Manifest } from '../../../models/Manifest';
import { ScrollPanel } from 'primeng/scrollpanel';
import { DatePipe } from '@angular/common';
import { NavigationService } from '../../../services/navigation.service';
import {
  ConfirmationButton,
  ConfirmationDialog,
  ConfirmationOptions,
} from '../../components/dialogs/confirmation/confirmation.dialog';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'app-open-screen',
  imports: [
    InputText,
    Button,
    RouterLink,
    InputGroup,
    InputGroupAddon,
    Fieldset,
    FormsModule,
    ScrollPanel,
    DatePipe,
    Tooltip,
  ],
  providers: [DialogService],
  templateUrl: './open.screen.html',
  styleUrl: './open.screen.scss',
})
export class OpenScreen implements OnInit {
  protected readonly windowState: WindowState = inject(WindowState);

  protected readonly storage: StorageService = inject(StorageService);
  protected readonly navigation: NavigationService = inject(NavigationService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

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

  constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  public ngOnInit(): void {
    this.windowState.setTitle('Open Project', 'pi pi-folder-open');
    void this.storage.refreshManifests();
  }

  protected handleOpenProject(projectId: string): void {
    void this.navigation.navigateToProject(projectId);
  }

  protected handleDeleteProject(manifest: Manifest): void {
    const acceptButton: ConfirmationButton = {
      label: 'Yes, I want delete it',
      size: 'small',
      severity: 'danger',
      variant: 'outlined',
      click: (): void => {
        void this.storage.removeProject(manifest.projectId);
        this.dialogRef?.close();
      },
    };
    const cancelButton: ConfirmationButton = {
      label: `Cancel`,
      size: 'small',
      variant: 'outlined',
      click: (): void => this.dialogRef?.close(),
    };

    const options: ConfirmationOptions = {
      title: 'Deleting Project',
      message: `Do you really want to delete <span class="font-bold font-stretch-semi-expanded">${manifest.name}</span>? <br />
      Once deleted, it is gone forever.`,
      icon: 'pi-trash',
      justify: 'justify-around',
      buttons: [[cancelButton], [acceptButton]],
    };

    this.dialogRef = this.dialogService.open(ConfirmationDialog, {
      showHeader: false,
      closeOnEscape: true,
      dismissableMask: true,
      closable: true,
      inputValues: { options },
    });
  }

  protected handleDuplicateProject(manifest: Manifest): void {
    void this.storage.duplicateProject(manifest.projectId);
  }
}
