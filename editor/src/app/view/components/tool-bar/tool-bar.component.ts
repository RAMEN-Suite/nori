import {
  LucideDownload,
  LucidePanelLeft,
  LucideLayers,
  LucideArrowLeft,
  LucideRotateCcw,
  LucideMaximize,
  LucidePalette,
} from '@lucide/angular';
import {
  Component,
  inject,
  ChangeDetectionStrategy,
  input,
  computed,
  type Signal,
  output,
  type InputSignal,
  type OutputEmitterRef,
} from '@angular/core';
import { Button, Card, Tooltip, Divider } from '@sushi-kit/angular';
import { TranslocoDirective } from '@jsverse/transloco';
import { SettingsButtonComponent } from '../settings-button/settings-button.component';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../../services/dialog.service';
import { SettingsDialog } from '../dialogs/settings/settings.dialog';
import { Transformer } from '../../../core/helper/Transformer';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { ExportService } from '../../../services/export.service';
import { StorageService } from '../../../services/storage.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-tool-bar',
  host: { '(document:keydown)': 'handleShortcut($event)' },
  imports: [
    Button,
    Card,
    TranslocoDirective,
    SettingsButtonComponent,
    Tooltip,
    Divider,
    RouterLink,
    LucideDownload,
    LucidePanelLeft,
    LucideLayers,
    LucideArrowLeft,
    LucideRotateCcw,
    LucideMaximize,
    LucidePalette,
  ],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
})
export class ToolBarComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly router: Router = inject(Router);
  protected readonly export: ExportService = inject(ExportService);

  protected readonly canExport: Signal<boolean> = computed((): boolean => {
    this.workspace.store.currentModel();
    return this.storage.records().some((record): boolean => record.slot !== 0);
  });

  public readonly catalogueOpen: InputSignal<boolean> = input(true);
  public readonly levelsOpen: InputSignal<boolean> = input(false);
  public readonly toggleCatalogue: OutputEmitterRef<void> = output();
  public readonly toggleLevels: OutputEmitterRef<void> = output();

  public readonly resetGraph: OutputEmitterRef<void> = output();
  public readonly fitGraph: OutputEmitterRef<void> = output();
  public readonly configureColours: OutputEmitterRef<void> = output();

  private readonly shortcuts: Readonly<Record<string, () => void>> = {
    k: (): void => this.toggleCatalogue.emit(),
    m: (): void => this.toggleLevels.emit(),
    r: (): void => this.resetGraph.emit(),
    f: (): void => this.fitGraph.emit(),
    c: (): void => this.configureColours.emit(),
    e: (): void => {
      if (this.canExport()) void this.handleExportModel();
    },
    ',': (): void => {
      this.dialogs.open(SettingsDialog, { headerKey: 'common.settings' });
    },
  };

  protected handleShortcut(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.repeat || event.isComposing || this.dialogs.current()) return;
    const target: EventTarget | null = event.target;
    if (
      target instanceof Element &&
      target.closest('input, textarea, select, [contenteditable], [role="textbox"], [role="combobox"]')
    )
      return;

    if (this.handleBackShortcut(event)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action: (() => void) | undefined = this.shortcuts[event.key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    action();
  }

  private handleBackShortcut(event: KeyboardEvent): boolean {
    if (!event.altKey || event.key !== 'ArrowLeft' || event.ctrlKey || event.metaKey) return false;
    event.preventDefault();
    void this.router.navigate(['/']).catch((error: unknown): void => this.storage.reportError(error));
    return true;
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
}
