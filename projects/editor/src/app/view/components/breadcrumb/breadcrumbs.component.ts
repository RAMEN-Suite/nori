import { Component, DestroyRef, effect, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { Breadcrumb } from 'primeng/breadcrumb';
import { Chip } from 'primeng/chip';
import { ContextMenu } from 'primeng/contextmenu';
import { MenuItem } from 'primeng/api';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { StorageService } from '../../../services/storage.service';
import { ModelRecord } from '../../../models/ModelRecord';
import { Ripple } from 'primeng/ripple';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CreateModelDialog } from '../dialogs/create-model/create-model.dialog';
import { Tooltip } from 'primeng/tooltip';
import { ActivatedRoute } from '@angular/router';
import { NavigationService } from '../../../services/navigation.service';
import {
  ConfirmationButton,
  ConfirmationDialog,
  ConfirmationOptions,
} from '../dialogs/confirmation/confirmation.dialog';
import { ExportService } from '../../../services/export.service';
import { Transformer } from '../../../core/helper/Transformer';

type BreadcrumbItem = Omit<MenuItem, 'items'> & {
  label?: string;
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
  protected readonly export: ExportService = inject(ExportService);

  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly navigation: NavigationService = inject(NavigationService);

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
      command: (): void => void this.handleOpenEditModel(),
    },
    {
      label: 'Export Model',
      icon: 'pi pi-download',
      command: (): void => void this.handleExportModel(),
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

  protected handleOpenCreateModel(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateModelDialog, {
      header: 'Create Project Model',
      closeOnEscape: true,
      draggable: true,
      closable: true,
    });
  }

  protected handleOpenEditModel(): void {
    const currentSlot: number | undefined = this.selectedMenuItem()?.slot;
    if (!currentSlot) return;

    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateModelDialog, {
      header: 'Update Project Model',
      closeOnEscape: true,
      draggable: true,
      closable: true,
      inputValues: { currentSlot },
    });
  }

  protected handleChangeModelSlot(slot: number): void {
    if (this.workspace.store.currentSlot() === slot) return;
    void this.navigation.navigateToSlot(this.activatedRoute, slot);
  }

  protected handleContextMenu($event: MouseEvent, item: BreadcrumbItem): void {
    this.selectedMenuItem.set(item);
    this.contextMenuRef()?.show($event);
  }

  protected handleExportModel(): void {
    const slot: number = this.selectedMenuItem()?.slot ?? -1;
    const record: ModelRecord | undefined = this.storage.recordsBySlot().get(slot);
    if (!record || slot === -1) return;

    const camelized: string = Transformer.toCamelName(record.gmodel.name);
    const fileName: string = `${camelized}.gcore`;
    void this.export.exportJSON(record.gmodel, { fileName });
  }

  protected async handleDeleteModel(): Promise<void> {
    const slotToDelete: number | undefined = this.selectedMenuItem()?.slot;
    if (!slotToDelete) return;

    const acceptButton: ConfirmationButton = {
      label: 'Yes, I want delete it',
      size: 'small',
      severity: 'danger',
      variant: 'outlined',
      click: async (): Promise<void> => {
        await this.workspace.actions.removeSlot(slotToDelete);
        this.dialogRef?.close();

        const currentSlot: number = this.workspace.store.currentSlot();
        if (currentSlot !== slotToDelete) return;
        void this.navigation.navigateToSlot(this.activatedRoute, currentSlot - 1);
      },
    };
    const cancelButton: ConfirmationButton = {
      label: `Cancel`,
      size: 'small',
      variant: 'outlined',
      click: (): void => this.dialogRef?.close(),
    };

    const options: ConfirmationOptions = {
      title: 'Deleting Model',
      message: `Do you really want to delete <span class="font-bold font-stretch-semi-expanded">${this.selectedMenuItem()?.label}</span>? <br />
      Once deleted, it is gone forever.`,
      icon: 'pi-trash',
      justify: 'justify-around',
      buttons: [[cancelButton], [acceptButton]],
    };

    this.dialogRef = this.dialogService.open(ConfirmationDialog, {
      showHeader: false,
      closeOnEscape: true,
      dismissableMask: true,
      closable: true,
      inputValues: { options },
    });
  }

  private createBreadcrumb(): BreadcrumbItem[] {
    const models: Map<number, ModelRecord> = this.storage.recordsBySlot();
    const lastItem: BreadcrumbItem = { icon: 'pi pi-plus', isFirst: false, isLast: true };

    const modelLayers: BreadcrumbItem[] = [];
    for (const [slot, model] of models.entries()) {
      const suffix: string = model.name.length > 32 ? '...' : '';
      const label: string = model.name.slice(0, 32) + suffix;

      modelLayers.push({
        label: label,
        isFirst: slot === 0,
        isLast: false,
        slot: slot,
      });
    }

    return [...modelLayers, lastItem];
  }
}
