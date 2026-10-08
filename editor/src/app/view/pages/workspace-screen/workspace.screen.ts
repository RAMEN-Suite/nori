import {
  Component,
  effect,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  type WritableSignal,
  computed,
  type Signal,
} from '@angular/core';
import { WindowState } from '../../../states/window.state';
import { ToolBarComponent } from '../../components/tool-bar/tool-bar.component';
import { StorageService } from '../../../services/storage.service';
import { Manifest } from '../../../models/Manifest';
import { SideMenuComponent } from '../../components/side-menu/side-menu.component';
import { GraphMenuComponent } from '../../components/graph-view/graph-menu/graph-menu.component';
import { ActivatedRoute, NavigationEnd, ParamMap, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Card, Button } from '@sushi-kit/angular';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';
import { ModelLevelsComponent } from '../../components/model-levels/model-levels.component';
import { type GraphPadding } from '../../components/graph-view/graph/graph.types';
import { type ModelRecord } from '../../../models/ModelRecord';
import { PARAMETERS } from '../../../app.routes';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-workspace',
  imports: [
    ToolBarComponent,
    SideMenuComponent,
    GraphMenuComponent,
    RouterOutlet,
    ModelLevelsComponent,
    Card,
    Button,
    TranslocoDirective,
    LucideX,
  ],
  templateUrl: './workspace.screen.html',
  styleUrl: './workspace.screen.scss',
})
export class WorkspaceScreen implements OnInit {
  protected readonly windowState: WindowState = inject(WindowState);

  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);

  protected readonly router: Router = inject(Router);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  protected readonly levelsOpen: WritableSignal<boolean> = signal(true);
  protected readonly catalogueOpen: WritableSignal<boolean> = signal(true);
  protected readonly inspectorOpen: WritableSignal<boolean> = signal(false);

  protected readonly levelsHeight: Signal<string> = computed(
    (): string => `${136 + Math.min(5, Math.max(2, this.storage.records().length)) * 44}px`,
  );

  // Fit and Reset use the free canvas area; toggling panels preserves the saved viewport.
  protected readonly graphPadding: Signal<GraphPadding> = computed(
    (): GraphPadding => ({
      top: 100,
      bottom: 64,
      left: this.catalogueOpen() || this.levelsOpen() ? 296 : 32,
      right: this.inspectorOpen() ? 392 : 32,
    }),
  );

  public constructor() {
    this.router.events
      .pipe(
        filter((event: unknown): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(this.registerRouteSubscription.bind(this));

    effect((): void => this.ensureSelectedLevel());

    effect((): void => {
      this.inspectorOpen.set(!!this.workspace.store.currentNodeId());
    });

    effect((): void => {
      const manifest: Manifest | null = this.storage.selectedManifest();
      this.windowState.setTitle(manifest?.name ?? '');
    });
  }

  public ngOnInit(): void {
    this.registerRouteSubscription();
    void this.storage.refreshManifests();
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

  private registerRouteSubscription(): void {
    const projectId: string | null = this.activatedRoute.snapshot.paramMap.get(PARAMETERS.PROJECT);
    if (projectId) this.storage.selectProject(projectId);

    let route: ActivatedRoute | null = this.activatedRoute;
    while (route.firstChild) route = route.firstChild;

    const paramMap: ParamMap = route.snapshot.paramMap;
    const slot: string | null = paramMap.get(PARAMETERS.SLOT);
    const nodeId: string | null = paramMap.get(PARAMETERS.NODE);

    this.workspace.store.setCurrentSlot(slot ? Number(slot) : null);
    this.workspace.store.setCurrentNodeId(nodeId ?? null);
  }
}
