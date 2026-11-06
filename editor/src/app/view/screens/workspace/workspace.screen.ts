import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  type OnInit,
  type OnDestroy,
  signal,
  linkedSignal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, type ParamMap, Router, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideBoxes, LucideGitBranch, LucideLayers, LucideScanEye } from '@lucide/angular';
import { filter } from 'rxjs';
import { PARAMETERS } from '../../../app-route-parameters';
import { type Manifest } from '../../../models/Manifest';
import { type ModelRecord } from '../../../models/ModelRecord';
import { NavigationService } from '../../../services/interaction/navigation.service';
import { ProjectService } from '../../../services/projects/project.service';
import { NodeEditingService } from '../../../services/workspace/editing/node-editing.service';
import { PropertyEditingService } from '../../../services/workspace/editing/property-editing.service';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { WindowState } from '../../../states/window.state';
import { BaseNodesComponent } from '../../components/workspace/catalogue/base-nodes/base-nodes.component';
import { EditorPanelComponent } from '../../components/shared/editor-panel/editor-panel.component';
import { GraphViewComponent } from '../../components/workspace/graph-view/graph-view.component';
import { type GraphPadding } from '../../components/workspace/graph-view/graph/graph.types';
import { ModelLevelsComponent } from '../../components/workspace/model-levels/model-levels.component';
import { RefinementsComponent } from '../../components/workspace/catalogue/refinements/refinements.component';
import { PropertyEditorComponent } from '../../components/workspace/property-editor/property-editor.component';
import { ToolBarComponent } from '../../components/workspace/tool-bar/tool-bar.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-workspace',
  imports: [
    ToolBarComponent,
    PropertyEditorComponent,
    RefinementsComponent,
    GraphViewComponent,
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
export class WorkspaceScreen implements OnInit, OnDestroy {
  private readonly windowState: WindowState = inject(WindowState);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly router: Router = inject(Router);
  private readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly propertyEditing: PropertyEditingService = inject(PropertyEditingService);
  private readonly nodeEditing: NodeEditingService = inject(NodeEditingService);

  protected readonly isLevelsPanelOpen: WritableSignal<boolean> = signal(true);
  protected readonly isCatalogueOpen: WritableSignal<boolean> = linkedSignal({
    source: this.nodeEditing.isCreating,
    computation: (creating: boolean, previous?: { value: boolean }): boolean => creating || (previous?.value ?? true),
  });
  protected readonly isBaseNodesPanelOpen: WritableSignal<boolean> = signal(true);
  protected readonly isInspectorOpen: WritableSignal<boolean> = linkedSignal({
    source: (): string | null => this.workspace.store.currentNodeId() ?? this.workspace.store.currentRelationId(),
    computation: (selection: string | null, previous?: { value: boolean }): boolean => !!selection || (previous?.value ?? true),
  });

  protected readonly levelsHeight: Signal<string> = computed(
    (): string => `calc(8.5rem + ${Math.min(6, Math.max(2, this.projects.records().length))} * 2.25rem)`,
  );
  protected readonly graphPadding: Signal<GraphPadding> = computed((): GraphPadding => ({
    top: 100,
    bottom: 64,
    left: this.isCatalogueOpen() || (this.isBaseNodesPanelOpen() && this.workspace.queries.isEditable()) ? 320 : 32,
    right: this.isInspectorOpen() || this.isLevelsPanelOpen() ? 320 : 32,
  }));

  public constructor() {
    this.router.events
      .pipe(
        filter((event: unknown): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((): void => {
        this.syncSelectionFromRoute();
        this.propertyEditing.closeOnNavigation();
      });

    effect((): void => this.ensureSelectedLevel());
    effect((): void => {
      if (!this.workspace.store.currentRelationId() || !this.workspace.store.currentModel()) return;
      if (!this.workspace.queries.currentRelation()) {
        void this.navigation
          .navigateToLevel(this.workspace.store.currentLevelIndex())
          .catch((error: unknown): void => this.projects.reportError(error));
      }
    });

    effect((): void => {
      const manifest: Manifest | null = this.projects.selectedManifest();
      this.windowState.setTitle(manifest?.name ?? '', 'pencil');
    });
  }

  public ngOnInit(): void {
    this.syncSelectionFromRoute();
    void this.projects.refreshManifests().catch((error: unknown): void => this.projects.reportError(error));
  }

  public ngOnDestroy(): void {
    this.projects.selectProject(null);
  }

  protected handleToggleCatalogue(): void {
    this.isCatalogueOpen.update((open: boolean): boolean => !open);
  }

  protected handleToggleLevels(): void {
    this.isLevelsPanelOpen.update((open: boolean): boolean => !open);
  }

  private ensureSelectedLevel(): void {
    const projectId: string | null = this.projects.loadedProjectId();
    if (!projectId || projectId !== this.activatedRoute.snapshot.paramMap.get(PARAMETERS.PROJECT)) return;
    if (this.projects.recordsByLevelIndex().has(this.workspace.store.currentLevelIndex())) return;

    const next: ModelRecord | undefined = this.projects.records().find((record: ModelRecord): boolean => record.levelIndex !== 0);
    void this.router
      .navigate(['/ws', projectId, next?.levelIndex ?? 0])
      .catch((error: unknown): void => this.projects.reportError(error));
  }

  private syncSelectionFromRoute(): void {
    const projectId: string | null = this.activatedRoute.snapshot.paramMap.get(PARAMETERS.PROJECT);
    if (projectId) this.projects.selectProject(projectId);

    let route: ActivatedRoute | null = this.activatedRoute;
    while (route.firstChild) route = route.firstChild;

    const paramMap: ParamMap = route.snapshot.paramMap;
    const levelIndex: string | null = paramMap.get(PARAMETERS.LEVEL);
    const nodeId: string | null = paramMap.get(PARAMETERS.NODE);

    this.workspace.store.selectLevel(levelIndex ? Number(levelIndex) : null);
    this.workspace.store.setCurrentNodeId(nodeId);
    const relationId: string | null = paramMap.get(PARAMETERS.RELATION);
    if (relationId) this.workspace.store.setCurrentRelationId(relationId);
  }
}
