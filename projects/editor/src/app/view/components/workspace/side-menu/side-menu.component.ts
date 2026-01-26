import { Component, computed, DestroyRef, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { PanelMenu } from 'primeng/panelmenu';
import { GNode } from '../../../../core/models/GModel';
import { IftaLabel } from 'primeng/iftalabel';
import { InputText } from 'primeng/inputtext';
import { ScrollPanel } from 'primeng/scrollpanel';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { Tooltip } from 'primeng/tooltip';
import { ContextMenu } from 'primeng/contextmenu';
import { FormsModule } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { ActivatedRoute } from '@angular/router';
import { NavigationService } from '../../../../services/navigation.service';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  ConfirmationButton,
  ConfirmationDialog,
  ConfirmationOptions,
} from '../../dialogs/confirmation/confirmation.dialog';
import { CreateNodeInput } from '../../../../core/GModelFactory';

type SideMenuItem = MenuItem & {
  isCategory?: boolean;
  parentId?: string;
  isActive?: boolean;
  button?: string;
  hasErrors?: boolean;
};

@Component({
  selector: 'app-side-menu',
  imports: [PanelMenu, IftaLabel, InputText, ScrollPanel, Button, Ripple, Tooltip, ContextMenu, FormsModule],
  providers: [DialogService, DynamicDialogRef],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
})
export class SideMenuComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly navigation: NavigationService = inject(NavigationService);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

  protected readonly selectedContextItem: WritableSignal<SideMenuItem | null> = signal(null);
  protected readonly contextMenu: WritableSignal<SideMenuItem[]> = signal([]);
  protected readonly contextMenuRef: Signal<ContextMenu | undefined> = viewChild('contextMenuRef');

  protected readonly searchInput: WritableSignal<string> = signal('');
  protected readonly staticContextMenu: SideMenuItem[] = [
    {
      label: 'Duplicate %s',
      icon: 'pi pi-copy',
      command: (): Promise<void> => this.handleDuplicateNode(),
      hasErrors: true,
    },
    { separator: true },
    {
      label: 'Delete %s',
      icon: 'pi pi-trash',
      severity: 'error',
      command: (): Promise<void> => this.handleDeleteNode(),
    },
  ];

  protected readonly sideMenuItems: Signal<SideMenuItem[]> = computed((): SideMenuItem[] => this.createSideMenu());
  protected readonly filteredMenuItems: Signal<SideMenuItem[]> = computed((): SideMenuItem[] => this.filterMenuItems());

  constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  private createSideMenu(): SideMenuItem[] {
    const baseNodes: GNode[] = this.workspace.view.baseNodes();
    const menuItems: SideMenuItem[] = [];

    for (const node of baseNodes) {
      const subMenu: SideMenuItem[] = this.createSubMenu(node.id);

      menuItems.push({
        id: node.id,
        label: node.name,
        expanded: true,
        items: subMenu,
        badge: `${subMenu.length}`,
        button: `Create New ${node.name} Node`,
        isCategory: true,
      });
    }

    return menuItems;
  }

  private createSubMenu(baseId: string): SideMenuItem[] {
    const nodes: ReadonlyArray<GNode> = this.workspace.view.currentNodesByBaseId().get(baseId) ?? [];
    const currentItemId: string | null = this.workspace.store.currentNodeId();

    return nodes.map((derived: GNode): SideMenuItem => {
      return {
        id: derived.id,
        label: derived.name,
        parentId: baseId,
        isActive: !!(currentItemId && currentItemId === derived.id),
      };
    });
  }

  private filterMenuItems(): SideMenuItem[] {
    const query: string = this.searchInput().trim().toLowerCase();
    const sideMenu: SideMenuItem[] = this.sideMenuItems();
    if (!query) return sideMenu;

    return sideMenu
      .map((baseNode: SideMenuItem): SideMenuItem => {
        const baseLabel: string = (baseNode.label ?? '').toLowerCase();
        const draftItems: SideMenuItem[] = baseNode.items ?? [];

        if (baseLabel.includes(query)) return baseNode;
        const filteredDraft: SideMenuItem[] = draftItems.filter((draftItem: SideMenuItem): boolean => {
          return (draftItem.label ?? '').toLowerCase().includes(query);
        });

        return { ...baseNode, items: filteredDraft };
      })
      .filter((baseNode: SideMenuItem): boolean => {
        const baseLabel: string = (baseNode.label ?? '').toLowerCase();
        return baseLabel.includes(query) || (baseNode.items?.length ?? 0) > 0;
      });
  }

  protected async handleCreateNode(baseNodeId: string): Promise<void> {
    const input: CreateNodeInput = { name: 'Untitled', baseNodeId };
    const newNode: GNode = await this.workspace.actions.createNode(input);
    const selectedSlot: number = this.workspace.store.currentSlot();
    void this.navigation.navigateToNode(this.activatedRoute, selectedSlot, newNode.id);
  }

  protected async handleDuplicateNode(): Promise<void> {
    const nodeId: string | undefined = this.selectedContextItem()?.id;
    if (!nodeId) return;

    const newNode: GNode = await this.workspace.actions.duplicateNode(nodeId);
    const selectedSlot: number = this.workspace.store.currentSlot();
    void this.navigation.navigateToNode(this.activatedRoute, selectedSlot, newNode.id);
  }

  protected async handleDeleteNode(): Promise<void> {
    const selectedMenuItem: SideMenuItem | null = this.selectedContextItem();
    if (!selectedMenuItem) return;

    const acceptButton: ConfirmationButton = {
      label: 'Yes, I want delete it',
      size: 'small',
      severity: 'danger',
      variant: 'outlined',
      click: async (): Promise<void> => {
        if (!selectedMenuItem.id) return;
        await this.workspace.actions.removeNode(selectedMenuItem.id);
        this.dialogRef?.close();

        const selectedNodeId: string | null = this.workspace.store.currentNodeId();
        if (selectedMenuItem.id !== selectedNodeId) return;

        const selectedSlot: number = this.workspace.store.currentSlot();
        void this.navigation.navigateToSlot(this.activatedRoute, selectedSlot);
      },
    };
    const cancelButton: ConfirmationButton = {
      label: `Cancel`,
      size: 'small',
      variant: 'outlined',
      click: (): void => this.dialogRef?.close(),
    };

    const options: ConfirmationOptions = {
      title: 'Deleting Node',
      message: `Do you really want to delete <span class="font-bold font-stretch-semi-expanded">${selectedMenuItem.label}</span>? <br />
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

  protected handleSelectPanelItem(item: SideMenuItem): void {
    if (item.isCategory) return;
    const selectedSlot: number = this.workspace.store.currentSlot();
    void this.navigation.navigateToNode(this.activatedRoute, selectedSlot, item.id ?? null);
  }

  protected handleContextMenu($event: MouseEvent, clickedItem: SideMenuItem): void {
    this.selectedContextItem.set(clickedItem);

    this.contextMenu.set(
      this.staticContextMenu.map(
        (item: SideMenuItem): SideMenuItem => ({
          ...item,
          label: item.label?.replace('%s', clickedItem.label ?? 'Node'),
        }),
      ),
    );

    this.contextMenuRef()?.show($event);
  }
}
