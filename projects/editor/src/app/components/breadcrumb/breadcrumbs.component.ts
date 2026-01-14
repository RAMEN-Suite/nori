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
import { Breadcrumb } from 'primeng/breadcrumb';
import { Chip } from 'primeng/chip';
import { ContextMenu } from 'primeng/contextmenu';
import { MenuItem } from 'primeng/api';
import { WorkspaceService } from '../../services/workspace.service';
import { StorageService } from '../../services/storage.service';
import { Model } from '../../models/Model';
import { Ripple } from 'primeng/ripple';

@Component({
  selector: 'app-breadcrumbs',
  imports: [Breadcrumb, Chip, ContextMenu, Ripple],
  templateUrl: './breadcrumbs.component.html',
  styleUrl: './breadcrumbs.component.scss',
})
export class BreadcrumbsComponent implements OnInit {
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected breadcrumb: WritableSignal<MenuItem[]> = signal([]);
  protected contextMenu: MenuItem[] = [];
  protected selectedItem: MenuItem | undefined;

  @ViewChild('contextMenuRef') contextMenuRef: ContextMenu | undefined;
  @Output() openCreateModal: EventEmitter<void> = new EventEmitter();

  constructor() {
    effect((): void => {
      this.breadcrumb.set(this.createBreadcrumb());
    });
  }

  public ngOnInit(): void {
    this.contextMenu = [
      {
        label: 'Edit Model',
        icon: 'pi pi-pen-to-square',
        command: (): void => {},
      },
      {
        label: 'Lock Model',
        icon: 'pi pi-lock',
        command: (): void => {},
      },
      {
        label: 'Export Model',
        icon: 'pi pi-download',
        command: (): void => {},
      },
      {
        separator: true,
      },
      {
        label: 'Delete Model',
        icon: 'pi pi-trash',
        severity: 'error',
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
        label: `Model ${slot}`,
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
    this.selectedItem = item;
    this.contextMenuRef?.show($event);
  }

  protected async handleDeleteModel(): Promise<void> {
    const projectId: string | null = this.storage.selectedProjectId();
    if (!projectId) return;

    await this.storage.deleteSlot(projectId, this.selectedItem?.automationId);
  }
}
