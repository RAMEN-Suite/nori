import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Button } from '@sushi-kit/angular';
import { APP_THEME, ApplicationState } from '../../../states/application.state';
import { BreadcrumbsComponent } from '../breadcrumb/breadcrumbs.component';
import { RouterLink } from '@angular/router';
import { ModelRecord } from '../../../models/ModelRecord';
import { Transformer } from '../../../core/helper/Transformer';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { ExportService } from '../../../services/export.service';
import { StorageService } from '../../../services/storage.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-tool-bar',
  imports: [Button, BreadcrumbsComponent, RouterLink],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
})
export class ToolBarComponent {
  protected readonly APP_THEME: typeof APP_THEME = APP_THEME;
  protected readonly appState: ApplicationState = inject(ApplicationState);

  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly export: ExportService = inject(ExportService);

  protected async handleExportModel(): Promise<void> {
    const currentSlot: number = this.workspace.store.currentSlot();
    const record: ModelRecord | undefined = this.storage.recordsBySlot().get(currentSlot);
    if (!record) return;

    const camelized: string = Transformer.toCamelName(record.gmodel.name);
    const fileName: string = `${camelized}.json`;
    try {
      await this.export.exportJSON(this.workspace.store.getDraft().export(), { fileName });
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }

  protected handleToggleTheme(): void {
    const isDark: boolean = this.appState.state().theme === APP_THEME.DARK;
    this.appState.setTheme(isDark ? APP_THEME.LIGHT : APP_THEME.DARK);
  }
}
