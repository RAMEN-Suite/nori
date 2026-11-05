import { Router } from '@angular/router';
import { afterNextRender, computed, inject, Injectable, Injector, signal, type Signal, type WritableSignal } from '@angular/core';
import { ApplicationState } from '../../../states/application.state';
import { features } from '../../../../environments/features';
import type { WorkspaceLocation } from '../../../models/WorkspaceLocation';
import { NavigationService } from '../../interaction/navigation.service';
import { ProjectService } from '../../projects/project.service';
import { DialogService } from '../../interaction/dialog.service';
import { WorkspaceService } from '../workspace.service';

interface PropertySelection {
  readonly modelId: string;
  readonly nodeId: string;
  readonly attributeId: string | null;
}

interface PropertyHistoryEntry {
  readonly url: string;
  readonly name: string;
  readonly selection: PropertySelection;
}

/** Owns the node editing screen and its current node/property selection. */
@Injectable({ providedIn: 'root' })
export class PropertyEditingService {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly injector: Injector = inject(Injector);

  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly router: Router = inject(Router);
  private readonly projects: ProjectService = inject(ProjectService);

  private restoreTarget: HTMLElement | null = null;
  private session: number = 0;
  private exitTimer: number | null = null;
  private readonly leaving: WritableSignal<boolean> = signal(false);
  public readonly closing: Signal<boolean> = this.leaving.asReadonly();

  private readonly history: WritableSignal<readonly PropertyHistoryEntry[]> = signal([]);
  private readonly future: WritableSignal<readonly PropertyHistoryEntry[]> = signal([]);
  private readonly navigating: WritableSignal<boolean> = signal(false);

  public readonly annotationEditingEnabled: boolean = features.annotationEditing;
  public readonly section: WritableSignal<'properties' | 'shapes' | 'constraints' | 'relationships'> = signal('properties');
  public readonly changingNode: Signal<boolean> = this.navigating.asReadonly();
  public readonly previous: Signal<PropertyHistoryEntry | null> = computed(() => this.history().at(-1) ?? null);

  public readonly next: Signal<PropertyHistoryEntry | null> = computed(() => this.future().at(-1) ?? null);

  private readonly selection: WritableSignal<PropertySelection | null> = signal<PropertySelection | null>(null);

  public readonly isOpen: Signal<boolean> = computed(() => this.selection() !== null);

  public readonly current: Signal<PropertySelection | null> = computed((): PropertySelection | null => {
    const selection: PropertySelection | null = this.selection();
    if (!selection || !this.workspace.queries.currentNode()) return null;
    if (
      selection.modelId !== this.workspace.store.currentModel()?.id ||
      selection.nodeId !== this.workspace.store.currentNodeId()
    )
      return null;
    return selection;
  });

  public open(attributeId?: string | null, section: 'properties' | 'shapes' = 'properties'): void {
    const modelId: string | undefined = this.workspace.store.currentModel()?.id;
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!modelId || !nodeId || !this.workspace.queries.currentNode()) return;
    if (this.isOpen()) return;
    this.session++;
    this.restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    this.select(attributeId);
    this.section.set(section === 'shapes' && !this.annotationEditingEnabled ? 'properties' : section);
    this.dialogs.error.set(null);
  }

  public select(attributeId?: string | null): void {
    const modelId: string | undefined = this.workspace.store.currentModel()?.id;
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!modelId || !nodeId) return;
    this.selection.set({
      modelId,
      nodeId,
      attributeId: attributeId === undefined ? (this.workspace.queries.currentNode()?.attributes[0]?.id ?? null) : attributeId,
    });
  }

  public close(): void {
    if (!this.isOpen() || this.dialogs.pending() || this.closing()) return;
    const motion: boolean = this.appearance.state().animations && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!motion) {
      this.finishClose();
      return;
    }
    this.leaving.set(true);
    this.exitTimer = window.setTimeout((): void => this.finishClose(), 100);
  }

  private finishClose(): void {
    if (this.exitTimer !== null) window.clearTimeout(this.exitTimer);
    this.exitTimer = null;
    this.leaving.set(false);
    this.session++;
    this.selection.set(null);
    this.history.set([]);
    this.future.set([]);
    this.dialogs.error.set(null);
    const target: HTMLElement | null = this.restoreTarget;
    this.restoreTarget = null;
    afterNextRender(
      (): void => {
        if (target?.isConnected && !this.isOpen()) target.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  public closeOnNavigation(): void {
    if (!this.navigating() && this.isOpen()) this.finishClose();
  }

  public async inspect(location: WorkspaceLocation, attributeId?: string): Promise<boolean> {
    const selection: PropertySelection | null = this.current();
    const name: string | undefined = this.workspace.queries.currentNode()?.name;
    if (!selection || !name || this.workspace.context()?.projectId !== location.projectId) return false;

    const entry: PropertyHistoryEntry = { url: this.router.url, name, selection };
    const navigated: boolean = await this.navigate(() => this.navigation.navigateToLocation(location), attributeId);
    if (navigated) {
      this.history.update((history) => [...history, entry]);
      this.future.set([]);
    }
    return navigated;
  }

  public back(): Promise<boolean> {
    return this.travel(this.history, this.future);
  }

  public forward(): Promise<boolean> {
    return this.travel(this.future, this.history);
  }

  private async travel(
    source: WritableSignal<readonly PropertyHistoryEntry[]>,
    destination: WritableSignal<readonly PropertyHistoryEntry[]>,
  ): Promise<boolean> {
    const entry: PropertyHistoryEntry | undefined = source().at(-1);
    const selection: PropertySelection | null = this.current();
    const name: string | undefined = this.workspace.queries.currentNode()?.name;
    if (!entry || !selection || !name) return false;
    const current: PropertyHistoryEntry = { url: this.router.url, name, selection };
    const navigated: boolean = await this.navigate(() => this.navigation.navigateToUrl(entry.url), entry.selection.attributeId);
    if (navigated) {
      source.update((entries) => entries.slice(0, -1));
      destination.update((entries) => [...entries, current]);
    }
    return navigated;
  }

  private async navigate(action: () => Promise<boolean>, attributeId?: string | null): Promise<boolean> {
    const session: number = this.session;
    const projectId: string | undefined = this.workspace.context()?.projectId;
    if (!this.isOpen() || !projectId || this.dialogs.pending() || this.navigating()) return false;

    this.navigating.set(true);
    try {
      if (!(await action()) || this.session !== session || this.workspace.context()?.projectId !== projectId) return false;
      if (!this.workspace.queries.currentNode()) return false;
      this.select(attributeId);
      this.dialogs.error.set(null);
      return true;
    } catch (error: unknown) {
      this.projects.reportError(error);
      return false;
    } finally {
      this.navigating.set(false);
    }
  }
}
