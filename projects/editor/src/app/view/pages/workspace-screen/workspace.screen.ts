import { Component, effect, inject, OnInit } from '@angular/core';
import { WindowState } from '../../../states/window.state';
import { ToolBarComponent } from '../../components/bars/tool-bar/tool-bar.component';
import { StorageService } from '../../../services/storage.service';
import { Manifest } from '../../../models/Manifest';
import { SideMenuComponent } from '../../components/workspace/side-menu/side-menu.component';
import { VisualizerComponent } from '../../components/workspace/visualizations/visualizer/visualizer.component';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceService } from '../../../services/workspace.service';
import { NodeEditorComponent } from '../../components/workspace/node-editor/node-editor.component';

@Component({
  selector: 'app-workspace',
  imports: [ToolBarComponent, SideMenuComponent, VisualizerComponent, NodeEditorComponent],
  templateUrl: './workspace.screen.html',
  styleUrl: './workspace.screen.scss',
})
export class WorkspaceScreen implements OnInit {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly windowState: WindowState = inject(WindowState);
  protected readonly storage: StorageService = inject(StorageService);

  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly activatedRouteSubscription$: Subscription | undefined;

  constructor() {
    this.activatedRouteSubscription$ = this.activatedRoute.firstChild?.paramMap.subscribe(
      (map: ParamMap): void => {
        this.workspace.setDerivedNodeId(map.get('nodeId') ?? '');
      },
    );

    effect((): void => {
      const manifest: Manifest | null = this.storage.selectedManifest();
      this.windowState.setTitle(manifest?.name ?? '', 'pi pi-pen-to-square');
      console.log(this.workspace.validation());
    });
  }

  public async ngOnInit(): Promise<void> {
    void this.storage.refreshManifests();
  }
}
