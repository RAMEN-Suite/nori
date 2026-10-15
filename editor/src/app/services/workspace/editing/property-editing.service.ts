import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { Router } from '@angular/router';
import { computed, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LucidePencil } from '@lucide/angular';
import type { WorkspaceLocation } from '../../../models/WorkspaceLocation';
import { NavigationService } from '../../interaction/navigation.service';
import { RunningActionService } from '../workflows/running-action.service';
import { ProjectService } from '../../projects/project.service';
import { DialogService } from '../../interaction/dialog.service';
import { PropertyEditorComponent } from '../../../view/components/workspace/property-editor/property-editor.component';
import { WorkspaceService } from '../workspace.service';

interface PropertySelection {
  readonly modelId: string;
  readonly nodeId: string;
  readonly attributeId: string | null;
}

/** Owns the floating property workspace and its current node/property selection. */
@Injectable({ providedIn: 'root' })
export class PropertyEditingService {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly router: Router = inject(Router);
  private readonly actions: RunningActionService = inject(RunningActionService);
  private readonly projects: ProjectService = inject(ProjectService);

  private readonly overlays: Dialog = inject(Dialog);
  private readonly overlay: Overlay = inject(Overlay);

  private inspecting: boolean = false;
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

  public open(attributeId?: string | null): void {
    const modelId: string | undefined = this.workspace.store.currentModel()?.id;
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!modelId || !nodeId || !this.workspace.queries.currentNode()) return;
    if (this.dialogRef) return;

    this.select(attributeId);
    this.dialogs.error.set(null);
    const ref: DialogRef<undefined, PropertyEditorComponent> = this.overlays.open<undefined, unknown, PropertyEditorComponent>(
      PropertyEditorComponent,
      {
        ariaLabel: this.translations.translate('editor.editPropertiesOf', { name: this.workspace.queries.currentNode()?.name }),
        panelClass: 'nori-property-workspace-overlay',
        backdropClass: 'nori-property-workspace-backdrop',
        width: '60rem',
        positionStrategy: this.overlay.position().global().centerHorizontally().top('clamp(1rem, 16dvh, 8rem)'),
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100dvh - 2rem)',
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

  public async inspect(location: WorkspaceLocation): Promise<void> {
    const selection: PropertySelection | null = this.current();
    if (!selection || this.dialogs.pending() || this.inspecting || this.actions.pending()) return;

    const returnUrl: string = this.router.url;
    this.inspecting = true;
    let paused: boolean = false;
    try {
      paused = await this.actions.start({
        icon: LucidePencil.icon,
        severity: 'warning',
        projectId: location.projectId,
        titleKey: 'editor.runningPropertyEditing',
        descriptionKey: 'editor.runningPropertyEditingHint',
        resume: async (signal: AbortSignal): Promise<void> => {
          if (!(await this.navigation.navigateToUrl(returnUrl))) throw new Error('The previous view could not be opened.');
          if (!signal.aborted) this.open(selection.attributeId);
        },
      });
      if (!paused) return;
      if (this.current() !== selection) {
        this.actions.cancel();
        return;
      }

      this.close();
      if (!(await this.navigation.navigateToLocation(location))) await this.actions.resume();
    } catch (error: unknown) {
      this.projects.reportError(error);
      if (paused) await this.actions.resume();
    } finally {
      this.inspecting = false;
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
      this.dialogs.error.set(null);
    });
  }
}
