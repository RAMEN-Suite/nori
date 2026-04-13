import { Component, inject } from '@angular/core';
import { Menubar } from 'primeng/menubar';
import { Divider } from 'primeng/divider';
import { Button } from 'primeng/button';
import { APP_THEME, ApplicationState } from '../../../states/application.state';
import { BreadcrumbsComponent } from '../breadcrumb/breadcrumbs.component';
import { RouterLink } from '@angular/router';
import { Tooltip } from 'primeng/tooltip';
import { ModelRecord } from '../../../models/ModelRecord';
import { Transformer } from '../../../core/helper/Transformer';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { ExportService } from '../../../services/export.service';
import { StorageService } from '../../../services/storage.service';

@Component({
  selector: 'app-tool-bar',
  imports: [Menubar, Divider, Button, BreadcrumbsComponent, RouterLink, Tooltip],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
})
export class ToolBarComponent {
  protected readonly APP_THEME: typeof APP_THEME = APP_THEME;
  protected readonly appState: ApplicationState = inject(ApplicationState);

  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly export: ExportService = inject(ExportService);

  protected handleExportModel(): void {
    const currentSlot: number = this.workspace.store.currentSlot();
    const record: ModelRecord | undefined = this.storage.recordsBySlot().get(currentSlot);
    if (!record) return;

    const camelized: string = Transformer.toCamelName(record.gmodel.name);
    const fileName: string = `${camelized}.gcore`;
    void this.export.exportJSON(record.gmodel, { fileName });
  }

  protected handleToggleTheme(): void {
    const isDark: boolean = this.appState.state().theme === APP_THEME.DARK;
    this.appState.setTheme(isDark ? APP_THEME.LIGHT : APP_THEME.DARK);
  }
}
