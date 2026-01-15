import { Component, effect, inject, OnInit } from '@angular/core';
import { WindowState } from '../../../states/window.state';
import { ToolBarComponent } from '../../components/bars/tool-bar/tool-bar.component';
import { StorageService } from '../../../services/storage.service';
import { Manifest } from '../../../models/Manifest';
import { SideMenuComponent } from '../../components/side-menu/side-menu.component';
import { WorkspaceService } from '../../../services/workspace.service';

@Component({
  selector: 'app-workspace',
  imports: [ToolBarComponent, SideMenuComponent],
  templateUrl: './workspace.screen.html',
  styleUrl: './workspace.screen.scss',
})
export class WorkspaceScreen implements OnInit {
  private readonly windowState: WindowState = inject(WindowState);
  private readonly storage: StorageService = inject(StorageService);

  private readonly workspace: WorkspaceService = inject(WorkspaceService);

  constructor() {
    effect((): void => {
      const manifest: Manifest | null = this.storage.selectedManifest();
      this.windowState.setTitle(manifest?.name ?? '', 'pi pi-pen-to-square');
    });

    effect(() => {
      console.log(this.workspace.validation());
    });
  }

  public async ngOnInit(): Promise<void> {
    void this.storage.refreshManifests();
  }
}
