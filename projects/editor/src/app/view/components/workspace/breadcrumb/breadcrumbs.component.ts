import { Component, DestroyRef, effect, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { Breadcrumb } from 'primeng/breadcrumb';
import { Chip } from 'primeng/chip';
import { ContextMenu } from 'primeng/contextmenu';
import { MenuItem } from 'primeng/api';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { StorageService } from '../../../../services/storage.service';
import { ModelRecord } from '../../../../models/ModelRecord';
import { Ripple } from 'primeng/ripple';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CreateModelDialog } from '../../dialogs/create-model/create-model.dialog';
import { Tooltip } from 'primeng/tooltip';

type BreadcrumbItem = Omit<MenuItem, 'items'> & {
  isFirst?: boolean;
  isLast?: boolean;
  slot?: number;
};

@Component({
  selector: 'app-breadcrumbs',
  imports: [Breadcrumb, Chip, ContextMenu, Ripple, Tooltip],
  providers: [DialogService],
  templateUrl: './breadcrumbs.component.html',
  styleUrl: './breadcrumbs.component.scss',
})
export class BreadcrumbsComponent {
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

  protected readonly breadcrumb: WritableSignal<BreadcrumbItem[]> = signal([]);
  protected readonly selectedMenuItem: WritableSignal<BreadcrumbItem | null> = signal(null);

  protected readonly contextMenuRef: Signal<ContextMenu | undefined> = viewChild('contextMenuRef');
  protected readonly contextMenu: BreadcrumbItem[] = [
    {
      label: 'Edit Details',
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
      command: (): void => void this.handleDeleteModel(),
    },
  ];

  constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });

    effect((): void => {
      this.breadcrumb.set(this.createBreadcrumb());
    });
  }

  private createBreadcrumb(): BreadcrumbItem[] {
    const models: Map<number, ModelRecord> = this.storage.recordsBySlot();
    const firstItem: BreadcrumbItem = { label: 'Metamodel', isFirst: true, isLast: false };
    const lastItem: BreadcrumbItem = { icon: 'pi pi-plus', isFirst: false, isLast: true };

    const modelLayers: BreadcrumbItem[] = [];
    for (const slot of models.keys()) {
      if (slot === 0) continue;

      modelLayers.push({
        label: `Model ${slot}`,
        isFirst: false,
        isLast: false,
        slot: slot,
      });
    }

    return [firstItem, ...modelLayers, lastItem];
  }

  protected handleOpenCreateModal(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateModelDialog, {
      header: 'Create Domain Model',
      closeOnEscape: true,
      draggable: true,
      closable: true,
    });
  }

  protected handleChangeModelSlot(slot: number): void {
    if (this.workspace.store.selectedSlot() === slot) return;
    this.workspace.store.setSelectedSlot(slot);
  }

  protected handleContextMenu($event: MouseEvent, item: BreadcrumbItem): void {
    this.selectedMenuItem.set(item);
    this.contextMenuRef()?.show($event);
  }

  protected async handleDeleteModel(): Promise<void> {
    const slot: number | undefined = this.selectedMenuItem()?.slot;
    if (slot) await this.workspace.actions.deleteSlot(slot);
  }
}
