import { Component, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { WindowState } from '../../../states/window.state';
import { ToolBarComponent } from '../../components/header/tool-bar/tool-bar.component';
import { StorageService } from '../../../services/storage.service';
import { Manifest } from '../../../models/Manifest';
import { SideMenuComponent } from '../../components/side-menu/side-menu.component';
import { GraphMenuComponent } from '../../components/visualization/graph-menu/graph-menu.component';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceService } from '../../../services/workspace.service';
import { NodeEditorComponent } from '../../components/node-editor/node-editor.component';

@Component({
  selector: 'app-workspace',
  imports: [ToolBarComponent, SideMenuComponent, GraphMenuComponent, NodeEditorComponent],
  templateUrl: './workspace.screen.html',
  styleUrl: './workspace.screen.scss',
})
export class WorkspaceScreen implements OnInit, OnDestroy {
  protected readonly windowState: WindowState = inject(WindowState);

  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);

  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly activatedRouteSubscription$: Subscription | undefined;

  constructor() {
    this.activatedRouteSubscription$ = this.activatedRoute.firstChild?.paramMap.subscribe(
      (map: ParamMap): void => {
        const currentNodeId: string | null = map.get('nodeId');
        if (currentNodeId === null) return;
        this.workspace.store.setSelectedNodeId(currentNodeId);
      },
    );

    effect((): void => {
      const manifest: Manifest | null = this.storage.selectedManifest();
      this.windowState.setTitle(manifest?.name ?? '', 'pi pi-pen-to-square');
    });
  }

  public async ngOnInit(): Promise<void> {
    void this.storage.refreshManifests();
  }

  public ngOnDestroy(): void {
    this.workspace.store.resetSelections();
  }
}
