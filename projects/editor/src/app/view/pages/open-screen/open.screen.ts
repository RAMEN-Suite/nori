import { Component, computed, inject, OnInit, Signal, signal, WritableSignal } from '@angular/core';
import { StorageService } from '../../../services/storage.service';
import { WindowState } from '../../../states/window.state';
import { InputText } from 'primeng/inputtext';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { RouterLink } from '@angular/router';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddon } from 'primeng/inputgroupaddon';
import { Fieldset } from 'primeng/fieldset';
import { Manifest } from '../../../models/Manifest';
import { ScrollPanel } from 'primeng/scrollpanel';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-open-screen',
  imports: [
    InputText,
    ReactiveFormsModule,
    Button,
    RouterLink,
    InputGroup,
    InputGroupAddon,
    Fieldset,
    FormsModule,
    ScrollPanel,
    ConfirmDialog,
    DatePipe,
  ],
  providers: [ConfirmationService],
  templateUrl: './open.screen.html',
  styleUrl: './open.screen.scss',
})
export class OpenScreen implements OnInit {
  private readonly windowState: WindowState = inject(WindowState);
  private readonly storage: StorageService = inject(StorageService);
  private readonly confirmation: ConfirmationService = inject(ConfirmationService);

  protected readonly searchInput: WritableSignal<string> = signal('');
  protected readonly filteredManifest: Signal<Manifest[]> = computed((): Manifest[] => {
    const query: string = this.searchInput().trim().toLowerCase();
    const list: Manifest[] = this.storage.manifests();

    if (!query) return list;

    return list.filter(
      (manifest: Manifest): boolean =>
        manifest.name.toLowerCase().includes(query) ||
        manifest.projectId.toLowerCase().includes(query),
    );
  });

  public async ngOnInit(): Promise<void> {
    this.windowState.setTitle('Open Project', 'pi pi-folder-open');
    void this.storage.refreshManifests();
  }

  public async handleDeleteProject(manifest: Manifest): Promise<void> {
    this.confirmation.confirm({
      message: `Do you really want to delete ${manifest.name}?`,
      header: `Deleting Project`,
      key: 'open-projects',
      dismissableMask: true,
      rejectButtonProps: {
        label: 'Cancel',
        size: 'small',
        variant: 'outlined',
        severity: 'danger',
      },
      acceptButtonProps: {
        label: 'Yes, I want to delete my project',
        size: 'small',
        variant: 'outlined',
      },
      accept: async (): Promise<void> => void this.storage.deleteProject(manifest.projectId),
    });
  }

  public async handleDuplicateProject(manifest: Manifest): Promise<void> {
    void this.storage.duplicateProject(manifest.projectId);
  }
}
