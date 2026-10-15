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
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
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
import { DialogService } from '../../../../services/interaction/dialog.service';
import { ExportService } from '../../../../services/persistence/export.service';
import { ShortcutService } from '../../../../services/interaction/shortcut.service';
import { ProjectService } from '../../../../services/projects/project.service';
import { GraphToolsService } from '../../../../services/workspace/editing/graph-tools.service';
import { PropertyEditingService } from '../../../../services/workspace/editing/property-editing.service';
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
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly router: Router = inject(Router);
  private readonly export: ExportService = inject(ExportService);
  protected readonly shortcuts: ShortcutService = inject(ShortcutService);

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
    back: (): void => {
      void this.router.navigate(['/']).catch((error: unknown): void => this.projects.reportError(error));
    },
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
      this.graphTools.exit();
      return;
    }
    const action: ShortcutAction | null = this.shortcuts.resolve(event);
    if (!action) return;

    event.preventDefault();
    this.actions[action]();
  }

  protected handleEditProject(): void {
    const project: Manifest | null = this.projects.selectedManifest();
    if (project)
      this.dialogs.open(ProjectEditDialog, { headerKey: 'editor.editProject', width: '30rem', inputValues: { project } });
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
    void this.workspace.actions.undoRelation().catch((error: unknown): void => this.projects.reportError(error));
  }

  protected handleRedo(): void {
    if (this.graphTools.pending()) return;
    this.graphTools.cancel();
    void this.workspace.actions.redoRelation().catch((error: unknown): void => this.projects.reportError(error));
  }

  private isShortcutBlocked(event: KeyboardEvent): boolean {
    return (
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      !!this.dialogs.current() ||
      !!this.propertyEditing.current() ||
      this.isTextInput(event.target)
    );
  }

  private isTextInput(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      !!target.closest('input, textarea, select, [contenteditable], [role="textbox"], [role="combobox"]')
    );
  }
}
