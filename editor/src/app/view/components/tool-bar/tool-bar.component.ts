import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideMousePointer2,
  LucideArrowLeft,
  LucideDownload,
  LucideLayers,
  LucideBoxes,
  LucideSpline,
  LucideMaximize,
  LucidePalette,
  LucideGitBranch,
  LucidePencil,
  LucideNetwork,
  LucideEraser,
  LucideScanEye,
} from '@lucide/angular';
import { Button, Card, Divider } from '@sushi-kit/angular';
import { Transformer } from '../../../core/helper/Transformer';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { type Manifest } from '../../../models/Manifest';
import { type ShortcutAction } from '../../../models/Shortcut';
import { DialogService } from '../../../services/dialog.service';
import { ExportService } from '../../../services/export.service';
import { ShortcutService } from '../../../services/shortcut.service';
import { StorageService } from '../../../services/storage.service';
import { GraphToolsService } from '../../../services/workspace/graph-tools.service';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { ModelDiagnosticsDialog } from '../dialogs/model-diagnostics/model-diagnostics.dialog';
import { ProjectEditDialog } from '../dialogs/project-edit/project-edit.dialog';
import { SettingsDialog } from '../dialogs/settings/settings.dialog';
import { ModelValidationComponent } from '../model-validation/model-validation.component';
import { SettingsButtonComponent } from '../settings-button/settings-button.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-tool-bar',
  host: { '(document:keydown)': 'handleShortcut($event)' },
  imports: [
    ModelValidationComponent,
    Button,
    Card,
    TranslocoDirective,
    SettingsButtonComponent,
    TooltipDirective,
    Divider,
    RouterLink,
    LucideDownload,
    LucidePencil,
    LucideGitBranch,
    LucideLayers,
    LucideBoxes,
    LucideMousePointer2,
    LucideArrowLeft,
    LucideNetwork,
    LucideMaximize,
    LucidePalette,
    LucideSpline,
    LucideEraser,
    LucideScanEye,
  ],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
})
export class ToolBarComponent {
  protected readonly graphTools: GraphToolsService = inject(GraphToolsService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly router: Router = inject(Router);
  private readonly export: ExportService = inject(ExportService);

  public readonly catalogueOpen: InputSignal<boolean> = input(true);
  public readonly levelsOpen: InputSignal<boolean> = input(false);
  public readonly baseNodesOpen: InputSignal<boolean> = input(true);
  public readonly inspectorOpen: InputSignal<boolean> = input(true);
  public readonly toggleInspector: OutputEmitterRef<void> = output();
  public readonly toggleBaseNodes: OutputEmitterRef<void> = output();
  public readonly toggleCatalogue: OutputEmitterRef<void> = output();
  public readonly toggleLevels: OutputEmitterRef<void> = output();
  public readonly resetGraph: OutputEmitterRef<void> = output();
  public readonly fitGraph: OutputEmitterRef<void> = output();
  public readonly configureColours: OutputEmitterRef<void> = output();

  protected readonly shortcuts: ShortcutService = inject(ShortcutService);

  private readonly actions: Readonly<Record<ShortcutAction, () => void>> = {
    connect: (): void => this.graphTools.toggle('connect'),
    select: (): void => this.graphTools.exit(),
    erase: (): void => this.graphTools.toggle('erase'),
    refinements: (): void => {
      if (this.workspace.view.editable()) this.toggleCatalogue.emit();
    },
    baseNodes: (): void => {
      if (this.workspace.view.editable()) this.toggleBaseNodes.emit();
      else this.toggleCatalogue.emit();
    },
    levels: (): void => this.toggleLevels.emit(),
    inspector: (): void => this.toggleInspector.emit(),
    reset: (): void => this.handleResetLayout(),
    fit: (): void => this.fitGraph.emit(),
    colours: (): void => this.configureColours.emit(),
    project: (): void => this.handleEditProject(),
    validation: (): void => {
      this.dialogs.open(ModelDiagnosticsDialog, { size: 'compact', headerKey: 'editor.validationTitle' });
    },
    export: (): void => {
      if (this.canExport()) void this.handleExportModel();
    },
    undo: (): void => this.handleUndo(),
    redo: (): void => this.handleRedo(),
    redoAlternative: (): void => this.handleRedo(),
    back: (): void => {
      void this.router.navigate(['/']).catch((error: unknown): void => this.storage.reportError(error));
    },
    settings: (): void => {
      this.dialogs.open(SettingsDialog, { closeOnBackdrop: true, headerKey: 'common.settings', width: '42rem' });
    },
  };

  protected readonly canExport: Signal<boolean> = computed((): boolean =>
    this.storage.records().some((record): boolean => record.slot !== 0),
  );

  protected handleShortcut(event: KeyboardEvent): void {
    if (this.isShortcutBlocked(event)) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.graphTools.exit();
      return;
    }
    const action: ShortcutAction | null = this.shortcuts.resolve(event);
    if (!action) return;

    event.preventDefault();
    this.actions[action]();
  }

  protected handleEditProject(): void {
    const project: Manifest | null = this.storage.selectedManifest();
    if (project) this.dialogs.open(ProjectEditDialog, { headerKey: 'editor.editProject', inputValues: { project } });
  }

  protected async handleExportModel(): Promise<void> {
    const name: string = this.storage.selectedManifest()?.name ?? 'model';
    const fileName: string = `${Transformer.toCamelName(name)}.json`;
    try {
      await this.export.exportJSON(this.workspace.store.exportModel(), { fileName });
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }

  protected handleResetLayout(): void {
    if (this.workspace.view.editable()) this.resetGraph.emit();
  }

  protected handleUndo(): void {
    if (this.graphTools.pending()) return;
    this.graphTools.cancel();
    void this.workspace.actions.undoRelation().catch((error: unknown): void => this.storage.reportError(error));
  }

  protected handleRedo(): void {
    if (this.graphTools.pending()) return;
    this.graphTools.cancel();
    void this.workspace.actions.redoRelation().catch((error: unknown): void => this.storage.reportError(error));
  }

  private isShortcutBlocked(event: KeyboardEvent): boolean {
    return (
      event.defaultPrevented || event.repeat || event.isComposing || !!this.dialogs.current() || this.isTextInput(event.target)
    );
  }

  private isTextInput(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      !!target.closest('input, textarea, select, [contenteditable], [role="textbox"], [role="combobox"]')
    );
  }
}
