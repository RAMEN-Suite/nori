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
  LucideArrowLeft,
  LucideDownload,
  LucideLayers,
  LucideLink2,
  LucideMaximize,
  LucidePalette,
  LucidePanelLeft,
  LucidePencil,
  LucideRotateCcw,
  LucideUnlink,
} from '@lucide/angular';
import { Button, Card, Divider, Tooltip } from '@sushi-kit/angular';
import { Transformer } from '../../../core/helper/Transformer';
import { type Manifest } from '../../../models/Manifest';
import { DialogService } from '../../../services/dialog.service';
import { ExportService } from '../../../services/export.service';
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
    Tooltip,
    Divider,
    RouterLink,
    LucideDownload,
    LucidePencil,
    LucidePanelLeft,
    LucideLayers,
    LucideArrowLeft,
    LucideRotateCcw,
    LucideMaximize,
    LucidePalette,
    LucideLink2,
    LucideUnlink,
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
  protected readonly export: ExportService = inject(ExportService);

  public readonly catalogueOpen: InputSignal<boolean> = input(true);
  public readonly levelsOpen: InputSignal<boolean> = input(false);
  public readonly toggleCatalogue: OutputEmitterRef<void> = output();
  public readonly toggleLevels: OutputEmitterRef<void> = output();
  public readonly resetGraph: OutputEmitterRef<void> = output();
  public readonly fitGraph: OutputEmitterRef<void> = output();
  public readonly configureColours: OutputEmitterRef<void> = output();

  private readonly shortcuts: Readonly<Record<string, () => void>> = {
    l: (): void => this.graphTools.toggle('connect'),
    d: (): void => this.graphTools.toggle('disconnect'),
    escape: (): void => this.graphTools.cancel(),
    k: (): void => this.toggleCatalogue.emit(),
    m: (): void => this.toggleLevels.emit(),
    r: (): void => this.resetGraph.emit(),
    f: (): void => this.fitGraph.emit(),
    c: (): void => this.configureColours.emit(),
    p: (): void => this.handleEditProject(),
    v: (): void => {
      this.dialogs.open(ModelDiagnosticsDialog, { headerKey: 'editor.validationTitle' });
    },
    e: (): void => {
      if (this.canExport()) void this.handleExportModel();
    },
    ',': (): void => {
      this.dialogs.open(SettingsDialog, { headerKey: 'common.settings' });
    },
  };

  protected readonly canExport: Signal<boolean> = computed((): boolean => {
    this.workspace.store.currentModel();
    return this.storage.records().some((record): boolean => record.slot !== 0);
  });

  protected handleShortcut(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.repeat || event.isComposing || this.dialogs.current()) return;
    if (this.isTextInput(event.target)) return;

    if (this.handleUndoShortcut(event) || this.handleBackShortcut(event)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action: (() => void) | undefined = this.shortcuts[event.key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    action();
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

  private isTextInput(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      !!target.closest('input, textarea, select, [contenteditable], [role="textbox"], [role="combobox"]')
    );
  }

  private handleUndoShortcut(event: KeyboardEvent): boolean {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'z') return false;
    event.preventDefault();
    void this.workspace.actions.undoRelation().catch((error: unknown): void => this.storage.reportError(error));
    return true;
  }

  private handleBackShortcut(event: KeyboardEvent): boolean {
    if (!event.altKey || event.key !== 'ArrowLeft' || event.ctrlKey || event.metaKey) return false;
    event.preventDefault();
    void this.router.navigate(['/']).catch((error: unknown): void => this.storage.reportError(error));
    return true;
  }
}
