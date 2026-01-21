import { Component, computed, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
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
import { ConfirmationService, MenuItem } from 'primeng/api';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmDialog } from 'primeng/confirmdialog';

type SideMenuItem = MenuItem & {
  isCategory?: boolean;
  parentId?: string;
  isActive?: boolean;
  button?: string;
  hasErrors?: boolean;
};

@Component({
  selector: 'app-side-menu',
  imports: [
    PanelMenu,
    IftaLabel,
    InputText,
    ScrollPanel,
    Button,
    Ripple,
    Tooltip,
    ContextMenu,
    FormsModule,
    ConfirmDialog,
  ],
  providers: [ConfirmationService],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
})
export class SideMenuComponent {
  protected readonly confirmation: ConfirmationService = inject(ConfirmationService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly router: Router = inject(Router);

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
    const nodes: ReadonlyArray<GNode> = this.workspace.view.workNodesByBaseId().get(baseId) ?? [];
    const currentItemId: string | null = this.workspace.store.selectedNodeId();

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
    const newNode: GNode = await this.workspace.actions.createNode('Untitled', baseNodeId);
    void this.router.navigate([newNode.id], { relativeTo: this.activatedRoute });
    this.workspace.store.setSelectedNodeId(newNode.id);
  }

  protected async handleDuplicateNode(): Promise<void> {
    const nodeId: string | undefined = this.selectedContextItem()?.id;
    if (!nodeId) return;

    const newNode: GNode = await this.workspace.actions.duplicateNode(nodeId);
    void this.router.navigate([newNode.id], { relativeTo: this.activatedRoute });
    this.workspace.store.setSelectedNodeId(newNode.id);
  }

  protected async handleDeleteNode(): Promise<void> {
    const selectedMenuItem: SideMenuItem | null = this.selectedContextItem();
    if (!selectedMenuItem) return;

    this.confirmation.confirm({
      message: `Do you really want to delete "${selectedMenuItem.label}"?`,
      header: 'Delete Node',
      key: 'side-menu',
      dismissableMask: true,
      rejectButtonProps: {
        label: 'Cancel',
        size: 'small',
        variant: 'outlined',
      },
      acceptButtonProps: {
        label: 'Yes, I want to delete my node',
        size: 'small',
        variant: 'outlined',
        severity: 'danger',
      },
      accept: async (): Promise<void> => {
        if (!selectedMenuItem.id) return;
        await this.workspace.actions.deleteNode(selectedMenuItem.id);
        void this.router.navigate([], { relativeTo: this.activatedRoute });
      },
    });
  }

  protected handleSelectPanelItem(item: SideMenuItem): void {
    if (item.isCategory) return;
    this.workspace.store.setSelectedNodeId(item.id ?? null);
    void this.router.navigate([item.id], { relativeTo: this.activatedRoute });
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
