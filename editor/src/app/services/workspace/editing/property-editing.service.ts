import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { Router } from '@angular/router';
import { computed, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { WorkspaceLocation } from '../../../models/WorkspaceLocation';
import { NavigationService } from '../../interaction/navigation.service';
import { ProjectService } from '../../projects/project.service';
import { DialogService } from '../../interaction/dialog.service';
import { PropertyEditorComponent } from '../../../view/components/workspace/property-editor/property-editor.component';
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

/** Owns the floating property workspace and its current node/property selection. */
@Injectable({ providedIn: 'root' })
export class PropertyEditingService {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly router: Router = inject(Router);
  private readonly projects: ProjectService = inject(ProjectService);

  private readonly overlays: Dialog = inject(Dialog);
  private readonly overlay: Overlay = inject(Overlay);

  private readonly history: WritableSignal<readonly PropertyHistoryEntry[]> = signal([]);
  private readonly navigating: WritableSignal<boolean> = signal(false);

  public readonly section: WritableSignal<'properties' | 'shapes'> = signal('properties');
  public readonly changingNode: Signal<boolean> = this.navigating.asReadonly();
  public readonly previous: Signal<PropertyHistoryEntry | null> = computed(() => this.history().at(-1) ?? null);
  private dialogRef: DialogRef<undefined, PropertyEditorComponent> | null = null;

  private readonly selection: WritableSignal<PropertySelection | null> = signal<PropertySelection | null>(null);

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
    if (this.dialogRef) return;

    this.select(attributeId);
    this.section.set(section);
    this.dialogs.error.set(null);
    const ref: DialogRef<undefined, PropertyEditorComponent> = this.overlays.open<undefined, unknown, PropertyEditorComponent>(
      PropertyEditorComponent,
      {
        ariaLabel: this.translations.translate('editor.nodeDetails'),
        ariaDescribedBy: 'property-workspace-node-title',
        panelClass: 'nori-property-workspace-overlay',
        backdropClass: 'nori-property-workspace-backdrop',
        width: '60rem',
        positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
        maxWidth: 'calc(100vw - 2rem)',
        height: 'calc(100dvh - 2 * var(--nori-property-workspace-inset))',
        disableClose: true,
        autoFocus: 'dialog',
        restoreFocus: true,
      },
    );

    this.dialogRef = ref;
    this.observeDialog(ref);
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
    if (!this.dialogs.pending()) this.dialogRef?.close();
  }

  public closeOnNavigation(): void {
    if (!this.navigating()) this.close();
  }

  public async inspect(location: WorkspaceLocation, attributeId?: string): Promise<boolean> {
    const selection: PropertySelection | null = this.current();
    const name: string | undefined = this.workspace.queries.currentNode()?.name;
    if (!selection || !name || this.workspace.context()?.projectId !== location.projectId) return false;

    const entry: PropertyHistoryEntry = { url: this.router.url, name, selection };
    const navigated: boolean = await this.navigate(() => this.navigation.navigateToLocation(location), attributeId);
    if (navigated) this.history.update((history) => [...history, entry]);
    return navigated;
  }

  public async back(): Promise<boolean> {
    const entry: PropertyHistoryEntry | null = this.previous();
    if (!entry) return false;

    const navigated: boolean = await this.navigate(() => this.navigation.navigateToUrl(entry.url), entry.selection.attributeId);
    if (navigated) this.history.update((history) => history.slice(0, -1));
    return navigated;
  }

  private async navigate(action: () => Promise<boolean>, attributeId?: string | null): Promise<boolean> {
    const ref: DialogRef<undefined, PropertyEditorComponent> | null = this.dialogRef;
    const projectId: string | undefined = this.workspace.context()?.projectId;
    if (!ref || !projectId || this.dialogs.pending() || this.navigating()) return false;

    this.navigating.set(true);
    try {
      if (!(await action()) || this.dialogRef !== ref || this.workspace.context()?.projectId !== projectId) return false;
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

  private observeDialog(ref: DialogRef<undefined, PropertyEditorComponent>): void {
    ref.keydownEvents.subscribe((event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) ref.componentInstance?.handleEscape(event);
    });
    ref.closed.subscribe((): void => {
      if (this.dialogRef !== ref) return;
      this.dialogRef = null;
      this.selection.set(null);
      this.history.set([]);
      this.dialogs.error.set(null);
    });
  }
}
