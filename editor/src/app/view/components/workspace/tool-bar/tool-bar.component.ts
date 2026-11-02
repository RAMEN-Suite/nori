import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideUndo2,
  LucideRedo2,
  LucideDynamicIcon,
  type LucideIconData,
  LucideMousePointer2,
  LucideArrowLeft,
  LucideDownload,
  LucideImageDown,
  LucideFileCode,
  LucideFileImage,
  LucideLayers,
  LucideBoxes,
  LucideSpline,
  LucideMaximize,
  LucidePalette,
  LucideGitBranch,
  LucideNetwork,
  LucideEraser,
  LucideScanEye,
} from '@lucide/angular';
import { Button, Card, Divider, Menu, MenuTrigger, MenuItemTemplate, type MenuItem } from '@sushi-kit/angular';
import { toCamelName } from '../../../../utils/model-names';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { type Manifest } from '../../../../models/Manifest';
import { type ShortcutAction } from '../../../../utils/shortcuts/definitions';
import { ActionFeedbackService } from '../../../../services/interaction/action-feedback.service';
import { NavigationService } from '../../../../services/interaction/navigation.service';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { ExportService } from '../../../../services/persistence/export.service';
import { ShortcutService } from '../../../../services/interaction/shortcut.service';
import { ProjectService } from '../../../../services/projects/project.service';
import { GraphToolsService } from '../../../../services/workspace/editing/graph-tools.service';
import { PropertyEditingService } from '../../../../services/workspace/editing/property-editing.service';
import { ModelHistoryService } from '../../../../services/workspace/model/model-history.service';
import { InteractionStateService } from '../../../../services/interaction/interaction-state.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { ModelDiagnosticsDialog } from '../../dialogs/model-diagnostics/model-diagnostics.dialog';
import { ProjectEditDialog } from '../../dialogs/project-edit/project-edit.dialog';
import { SettingsDialog } from '../../dialogs/settings/settings.dialog';
import { ModelValidationComponent } from '../model-validation/model-validation.component';
import { SettingsButtonComponent } from '../../shell/settings-button/settings-button.component';
import { type GraphImageFormat } from '../graph-view/graph/graph.image-export';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-tool-bar',
  host: { '(document:keydown)': 'handleShortcut($event)' },
  imports: [
    LucideDynamicIcon,
    ModelValidationComponent,
    Button,
    Card,
    TranslocoDirective,
    SettingsButtonComponent,
    TooltipDirective,
    Divider,
    Menu,
    MenuTrigger,
    MenuItemTemplate,
    RouterLink,
    LucideDownload,
    LucideImageDown,
    LucideFileCode,
    LucideFileImage,
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
  protected readonly projects: ProjectService = inject(ProjectService);
  private readonly propertyEditing: PropertyEditingService = inject(PropertyEditingService);
  private readonly feedback: ActionFeedbackService = inject(ActionFeedbackService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly export: ExportService = inject(ExportService);
  protected readonly shortcuts: ShortcutService = inject(ShortcutService);
  protected readonly interactions: InteractionStateService = inject(InteractionStateService);
  private readonly history: ModelHistoryService = inject(ModelHistoryService);

  public readonly catalogueOpen: InputSignal<boolean> = input(true);
  public readonly levelsOpen: InputSignal<boolean> = input(false);
  public readonly baseNodesOpen: InputSignal<boolean> = input(true);
  public readonly inspectorOpen: InputSignal<boolean> = input(true);
  public readonly toggleInspector: OutputEmitterRef<void> = output();
  public readonly toggleBaseNodes: OutputEmitterRef<void> = output();
  public readonly toggleCatalogue: OutputEmitterRef<void> = output();
  public readonly toggleLevels: OutputEmitterRef<void> = output();
  public readonly resetGraph: OutputEmitterRef<void> = output();
  public readonly exportImage: OutputEmitterRef<GraphImageFormat> = output();
  public readonly fitGraph: OutputEmitterRef<void> = output();
  public readonly configureColours: OutputEmitterRef<void> = output();

  protected readonly imageFormats: readonly MenuItem<GraphImageFormat>[] = [
    { label: 'SVG', value: 'svg' },
    { label: 'PNG', value: 'png' },
  ];

  protected readonly historyActions: readonly {
    id: 'undo' | 'redo';
    label: string;
    icon: LucideIconData;
    available: Signal<boolean>;
    run: () => void;
  }[] = [
    {
      id: 'undo',
      label: 'editor.undoModel',
      icon: LucideUndo2.icon,
      available: this.history.canUndo,
      run: (): void => this.handleUndo(),
    },
    {
      id: 'redo',
      label: 'editor.redoModel',
      icon: LucideRedo2.icon,
      available: this.history.canRedo,
      run: (): void => this.handleRedo(),
    },
  ];

  protected readonly exporting: WritableSignal<boolean> = signal(false);

  private readonly actions: Readonly<Record<ShortcutAction, () => void>> = {
    connect: (): void => this.graphTools.toggle('connect'),
    select: (): void => this.graphTools.exit(),
    erase: (): void => this.graphTools.toggle('erase'),
    refinements: (): void => {
      if (this.workspace.queries.editable()) this.toggleCatalogue.emit();
    },
    baseNodes: (): void => {
      if (this.workspace.queries.editable()) this.toggleBaseNodes.emit();
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
    exportSvg: (): void => this.handleExportImage('svg'),
    exportPng: (): void => this.handleExportImage('png'),
    settings: (): void => {
      this.dialogs.open(SettingsDialog, { closeOnBackdrop: true, headerKey: 'common.settings', width: '42rem' });
    },
  };

  protected readonly canExport: Signal<boolean> = computed((): boolean =>
    this.projects.records().some((record): boolean => record.levelIndex !== 0),
  );

  protected handleShortcut(event: KeyboardEvent): void {
    if (this.isShortcutBlocked(event)) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.handleEscape(event);
      return;
    }
    const action: ShortcutAction | null = this.shortcuts.resolve(event);
    if (!action) return;

    event.preventDefault();
    this.actions[action]();
  }

  private handleEscape(event: KeyboardEvent): void {
    if (this.interactions.current().phase === 'executing') return;
    if (this.feedback.cancelCurrent()) return;
    if (this.graphTools.tool() !== 'select' || this.graphTools.source()) {
      this.graphTools.exit();
      return;
    }
    if (!this.workspace.store.currentNodeId() && !this.workspace.store.currentRelationId()) return;
    void this.navigation
      .navigateToLevel(this.workspace.store.currentLevelIndex())
      .then((): void => {
        const target: EventTarget | null = event.target;
        if (document.activeElement === target && (target instanceof HTMLElement || target instanceof SVGElement)) target.blur();
      })
      .catch((error: unknown): void => this.projects.reportError(error));
  }

  protected handleEditProject(): void {
    const project: Manifest | null = this.projects.selectedManifest();
    if (project)
      this.dialogs.open(ProjectEditDialog, { headerKey: 'editor.updateProjectTitle', width: '30rem', inputValues: { project } });
  }

  protected async handleExportModel(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    const name: string = this.projects.selectedManifest()?.name ?? 'model';
    const fileName: string = `${toCamelName(name).toLowerCase()}.json`;
    try {
      await this.export.exportJSON(this.workspace.store.exportModel(), fileName);
    } catch (error: unknown) {
      this.projects.reportError(error);
    } finally {
      this.exporting.set(false);
    }
  }

  protected handleResetLayout(): void {
    this.resetGraph.emit();
  }

  protected handleExportImage(format: GraphImageFormat): void {
    if (this.workspace.store.currentModel()) this.exportImage.emit(format);
  }

  protected handleUndo(): void {
    if (this.graphTools.pending()) return;
    this.graphTools.cancel();
    void this.workspace.actions.undo().catch((error: unknown): void => this.projects.reportError(error));
  }

  protected handleRedo(): void {
    if (this.graphTools.pending()) return;
    this.graphTools.cancel();
    void this.workspace.actions.redo().catch((error: unknown): void => this.projects.reportError(error));
  }

  private isShortcutBlocked(event: KeyboardEvent): boolean {
    return (
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      !!this.dialogs.current() ||
      !!this.propertyEditing.current() ||
      this.isTextInput(event.target) ||
      (event.target instanceof Element &&
        !!event.target.closest(
          '[role="menu"], [role="listbox"], [role="tree"], [role="grid"], [role="tablist"], [role="slider"], [role="spinbutton"], [role="radiogroup"]',
        ))
    );
  }

  private isTextInput(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      !!target.closest('input, textarea, select, [contenteditable], [role="textbox"], [role="combobox"]')
    );
  }
}
