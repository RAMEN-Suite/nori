import { Component, effect, inject, OnInit } from '@angular/core';
import { WindowState } from '../../../states/window.state';
import { ToolBarComponent } from '../../components/workspace/tool-bar/tool-bar.component';
import { StorageService } from '../../../services/storage.service';
import { Manifest } from '../../../models/Manifest';
import { SideMenuComponent } from '../../components/workspace/side-menu/side-menu.component';
import { GraphMenuComponent } from '../../components/workspace/graph-view/graph-menu/graph-menu.component';
import { ActivatedRoute, NavigationEnd, ParamMap, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { PARAMETERS } from '../../../app.routes';

@Component({
  selector: 'app-workspace',
  imports: [ToolBarComponent, SideMenuComponent, GraphMenuComponent, RouterOutlet],
  templateUrl: './workspace.screen.html',
  styleUrl: './workspace.screen.scss',
})
export class WorkspaceScreen implements OnInit {
  protected readonly windowState: WindowState = inject(WindowState);

  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);

  protected readonly router: Router = inject(Router);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly activatedRouteSubscription$: Subscription | undefined;

  constructor() {
    this.activatedRouteSubscription$ = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(this.registerRouteSubscription.bind(this));

    effect((): void => {
      const manifest: Manifest | null = this.storage.selectedManifest();
      this.windowState.setTitle(manifest?.name ?? '', 'pi pi-pen-to-square');
      console.log(this.workspace.store.currentModel());
    });
  }

  private registerRouteSubscription(): void {
    const projectId: string | null = this.activatedRoute.snapshot.paramMap.get(PARAMETERS.PROJECT);
    if (projectId) this.storage.selectProject(projectId);

    let route: ActivatedRoute | null = this.activatedRoute;
    while (route?.firstChild) route = route.firstChild;

    const paramMap: ParamMap = route?.snapshot.paramMap;
    const slot: string | null = paramMap?.get(PARAMETERS.SLOT);
    const nodeId: string | null = paramMap?.get(PARAMETERS.NODE);

    this.workspace.store.setCurrentSlot(slot ? Number(slot) : null);
    this.workspace.store.setCurrentNodeId(nodeId ?? null);
  }

  public async ngOnInit(): Promise<void> {
    void this.storage.refreshManifests();
  }
}
