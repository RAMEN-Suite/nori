import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  type OnInit,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, type ParamMap, Router, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideBoxes, LucideGitBranch, LucideLayers, LucideScanEye } from '@lucide/angular';
import { filter } from 'rxjs';
import { PARAMETERS } from '../../../app.routes';
import { type Manifest } from '../../../models/Manifest';
import { type ModelRecord } from '../../../models/ModelRecord';
import { NavigationService } from '../../../services/navigation.service';
import { StorageService } from '../../../services/storage.service';
import { NodeEditingService } from '../../../services/workspace/node-editing.service';
import { PropertyEditingService } from '../../../services/workspace/property-editing.service';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { WindowState } from '../../../states/window.state';
import { BaseNodesComponent } from '../../components/base-nodes/base-nodes.component';
import { EditorPanelComponent } from '../../components/editor-panel/editor-panel.component';
import { GraphMenuComponent } from '../../components/graph-view/graph-menu/graph-menu.component';
import { type GraphPadding } from '../../components/graph-view/graph/graph.types';
import { ModelLevelsComponent } from '../../components/model-levels/model-levels.component';
import { SideMenuComponent } from '../../components/side-menu/side-menu.component';
import { ToolBarComponent } from '../../components/tool-bar/tool-bar.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-workspace',
  imports: [
    ToolBarComponent,
    SideMenuComponent,
    GraphMenuComponent,
    RouterOutlet,
    ModelLevelsComponent,
    EditorPanelComponent,
    BaseNodesComponent,
    TranslocoDirective,
    LucideBoxes,
    LucideGitBranch,
    LucideLayers,
    LucideScanEye,
  ],
  templateUrl: './workspace.screen.html',
  styleUrl: './workspace.screen.scss',
})
export class WorkspaceScreen implements OnInit {
  private readonly windowState: WindowState = inject(WindowState);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly storage: StorageService = inject(StorageService);
  private readonly router: Router = inject(Router);
  private readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  protected readonly propertyEditing: PropertyEditingService = inject(PropertyEditingService);

  private readonly nodeEditing: NodeEditingService = inject(NodeEditingService);

  protected readonly levelsOpen: WritableSignal<boolean> = signal(true);
  protected readonly catalogueOpen: WritableSignal<boolean> = signal(true);
  protected readonly baseNodesOpen: WritableSignal<boolean> = signal(true);
  protected readonly inspectorOpen: WritableSignal<boolean> = signal(true);

  protected readonly levelsHeight: Signal<string> = computed(
    (): string => `calc(8.5rem + ${Math.min(6, Math.max(2, this.storage.records().length))} * 2.25rem)`,
  );

  protected readonly graphPadding: Signal<GraphPadding> = computed(
    (): GraphPadding => ({
      top: 100,
      bottom: 64,
      left: this.catalogueOpen() || (this.baseNodesOpen() && this.workspace.view.editable()) ? 320 : 32,
      right: this.inspectorOpen() || this.levelsOpen() ? 320 : 32,
    }),
  );

  public constructor() {
    effect((): void => {
      if (this.nodeEditing.creating()) this.catalogueOpen.set(true);
    });
    this.router.events
      .pipe(
        filter((event: unknown): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((): void => {
        this.syncRouteSelection();
        this.propertyEditing.close();
      });

    effect((): void => this.ensureSelectedLevel());
    effect((): void => {
      if (!this.workspace.store.currentRelationId() || !this.workspace.store.currentModel()) return;
      if (!this.workspace.view.currentRelation()) {
        void this.navigation
          .navigateToSlot(this.workspace.store.currentSlot())
          .catch((error: unknown): void => this.storage.reportError(error));
      }
    });

    effect((): void => {
      if (this.workspace.store.currentNodeId() || this.workspace.store.currentRelationId()) this.inspectorOpen.set(true);
    });

    effect((): void => {
      const manifest: Manifest | null = this.storage.selectedManifest();
      this.windowState.setTitle(manifest?.name ?? '', 'pencil');
    });
  }

  public ngOnInit(): void {
    this.syncRouteSelection();
    void this.storage.refreshManifests().catch((error: unknown): void => this.storage.reportError(error));
  }

  protected handleToggleCatalogue(): void {
    this.catalogueOpen.update((open: boolean): boolean => !open);
  }

  protected handleToggleLevels(): void {
    this.levelsOpen.update((open: boolean): boolean => !open);
  }

  private ensureSelectedLevel(): void {
    const projectId: string | null = this.storage.loadedProjectId();
    if (!projectId || projectId !== this.activatedRoute.snapshot.paramMap.get(PARAMETERS.PROJECT)) return;
    if (this.storage.recordsBySlot().has(this.workspace.store.currentSlot())) return;

    const next: ModelRecord | undefined = this.storage.records().find((record: ModelRecord): boolean => record.slot !== 0);
    void this.router
      .navigate(['/ws', projectId, next?.slot ?? 0])
      .catch((error: unknown): void => this.storage.reportError(error));
  }

  private syncRouteSelection(): void {
    const projectId: string | null = this.activatedRoute.snapshot.paramMap.get(PARAMETERS.PROJECT);
    if (projectId) this.storage.selectProject(projectId);

    let route: ActivatedRoute | null = this.activatedRoute;
    while (route.firstChild) route = route.firstChild;

    const paramMap: ParamMap = route.snapshot.paramMap;
    const slot: string | null = paramMap.get(PARAMETERS.SLOT);
    const nodeId: string | null = paramMap.get(PARAMETERS.NODE);

    this.workspace.store.setCurrentSlot(slot ? Number(slot) : null);
    this.workspace.store.setCurrentNodeId(nodeId);
    const relationId: string | null = paramMap.get(PARAMETERS.RELATION);
    if (relationId) this.workspace.store.setCurrentRelationId(relationId);
  }
}
