import {
  Component,
  effect,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { Menubar } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { Divider } from 'primeng/divider';
import { Button } from 'primeng/button';
import { EDITOR_THEME, EditorState } from '../../../states/editor.state';
import { WorkspaceService } from '../../../services/workspace.service';
import { StorageService } from '../../../services/storage.service';
import { Breadcrumb } from 'primeng/breadcrumb';
import { Chip } from 'primeng/chip';
import { Model } from '../../../models/Model';
import { ContextMenu } from 'primeng/contextmenu';

//Todo, move breadcrumbs to component

@Component({
  selector: 'app-tool-bar',
  imports: [Menubar, Divider, Button, Breadcrumb, Chip, ContextMenu],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
})
export class ToolBarComponent implements OnInit {
  protected readonly EDITOR_THEME: typeof EDITOR_THEME = EDITOR_THEME;

  protected readonly editorState: EditorState = inject(EditorState);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);

  protected selectedBreadcrumbItem: MenuItem | undefined;
  protected breadcrumb: WritableSignal<MenuItem[]> = signal([]);
  protected breadcrumbMenu: MenuItem[] = [{}];

  @ViewChild('breadcrumbMenuRef') breadcrumbMenuRef: ContextMenu | undefined;
  @Output() openCreateModal: EventEmitter<void> = new EventEmitter();

  constructor() {
    effect((): void => {
      this.breadcrumb.set(this.createBreadcrumb());
    });
  }

  public ngOnInit(): void {
    this.breadcrumbMenu = [
      {
        label: 'Delete Layer',
        icon: 'pi pi-trash',
        command: (): Promise<void> => this.handleDeleteModel(),
      },
    ];
  }

  private createBreadcrumb(): MenuItem[] {
    const models: Map<number, Model> = this.storage.modelsBySlot();
    const firstItem: MenuItem = { label: 'Metamodel', isFirst: true, isLast: false };
    const lastItem: MenuItem = { icon: 'pi pi-plus', isFirst: false, isLast: true };

    const modelLayers: MenuItem[] = [];
    for (const [slot, _] of models) {
      if (slot === 0) continue;

      modelLayers.push({
        label: `Layer ${slot}`,
        isFirst: false,
        isLast: false,
        automationId: slot,
      });
    }

    return [firstItem, ...modelLayers, lastItem];
  }

  protected handleChangeModelSlot(slot: number): void {
    this.workspace.selectDerivedSlot(slot);
  }

  protected handleBreadcrumbMenu($event: Event, item: MenuItem): void {
    this.selectedBreadcrumbItem = item;
    this.breadcrumbMenuRef?.show($event);
  }

  protected async handleDeleteModel(): Promise<void> {
    const projectId: string | null = this.storage.selectedProjectId();
    if (!projectId) return;

    await this.storage.deleteSlot(projectId, this.selectedBreadcrumbItem?.automationId);
  }
}
