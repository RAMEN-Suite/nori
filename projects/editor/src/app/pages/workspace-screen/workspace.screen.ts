import { Component, effect, inject, OnInit } from '@angular/core';
import { WindowState } from '../../states/window.state';
import { ToolBarComponent } from '../../components/bars/tool-bar/tool-bar.component';
import { StorageService } from '../../services/storage.service';
import { Manifest } from '../../models/Manifest';
import { SideMenuComponent } from '../../components/side-menu/side-menu.component';
import { CreateModelModal } from '../../components/modals/create-model/create-model.modal';

@Component({
  selector: 'app-workspace',
  imports: [ToolBarComponent, SideMenuComponent, CreateModelModal],
  templateUrl: './workspace.screen.html',
  styleUrl: './workspace.screen.scss',
})
export class WorkspaceScreen implements OnInit {
  private readonly windowState: WindowState = inject(WindowState);
  private readonly storage: StorageService = inject(StorageService);

  protected isCreateModalVisible: boolean = false;

  constructor() {
    effect((): void => {
      const manifest: Manifest | null = this.storage.selectedManifest();
      this.windowState.setTitle(manifest?.name ?? '', 'pi pi-pen-to-square');
    });
  }

  public async ngOnInit(): Promise<void> {
    void this.storage.refreshManifests();
  }

  public async handleOpenCreateModal(): Promise<void> {
    this.isCreateModalVisible = true;
  }

  public async handleCloseCreateModal(): Promise<void> {
    this.isCreateModalVisible = false;
  }
}
