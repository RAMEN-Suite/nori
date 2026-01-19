import {
  Component,
  computed,
  inject,
  OnInit,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace.service';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConfirmDialog } from 'primeng/confirmdialog';

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
  providers: [RouterLink, ConfirmationService],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
})
export class SideMenuComponent implements OnInit {
  protected readonly confirmation: ConfirmationService = inject(ConfirmationService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly router: Router = inject(Router);

  protected readonly searchInput: WritableSignal<string> = signal('');
  protected staticContextMenu: MenuItem[] = [];

  protected readonly contextMenu: WritableSignal<MenuItem[]> = signal([]);
  protected readonly selectedContextItem: WritableSignal<MenuItem | null> = signal(null);
  protected readonly contextMenuRef: Signal<ContextMenu | undefined> = viewChild('contextMenuRef');

  protected readonly sideMenuItems: Signal<MenuItem[]> = computed((): MenuItem[] => {
    return this.createSideMenu();
  });
  protected readonly filteredMenuItems: Signal<MenuItem[]> = computed((): MenuItem[] => {
    return this.filterMenuItems();
  });

  public ngOnInit(): void {
    this.staticContextMenu = [
      {
        label: 'Duplicate %s',
        icon: 'pi pi-copy',
        command: (): void => {},
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
  }

  private createSideMenu(): MenuItem[] {
    const baseNodes: GNode[] = this.workspace.baseNodes();
    const menuItems: MenuItem[] = [];

    for (const node of baseNodes) {
      const subMenu: MenuItem[] = this.createSubMenu(node.id);

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

  private createSubMenu(baseId: string): MenuItem[] {
    const derivedNodes: GNode[] = this.workspace.filteredDraftNodes(baseId)();
    const currentItemId: string | null = this.workspace.selectedDerivedNodeId();

    return derivedNodes.map((derived: GNode): MenuItem => {
      return {
        id: derived.id,
        label: derived.name,
        parentId: baseId,
        isActive: currentItemId && currentItemId === derived.id,
      };
    });
  }

  private filterMenuItems(): MenuItem[] {
    const searchQuery: string = this.searchInput().trim().toLowerCase();
    const sideMenu: MenuItem[] = this.sideMenuItems();

    if (!searchQuery) return sideMenu;
    const clonedMenu: MenuItem[] = structuredClone(sideMenu);

    return clonedMenu.filter((baseNode: MenuItem): boolean => {
      const baseLabel: string = (baseNode.label ?? '').toLowerCase();
      if (baseLabel.includes(searchQuery)) return true;

      const derived: MenuItem[] = baseNode.items ?? [];
      const filteredDerived: MenuItem[] = derived.filter((node: MenuItem): boolean =>
        (node.label ?? '').toLowerCase().includes(searchQuery),
      );

      baseNode.items = filteredDerived;
      return filteredDerived.length > 0;
    });
  }

  protected async handleCreateNode(baseNodeId: string): Promise<void> {
    const newNode: GNode = await this.workspace.createNode('Untitled', baseNodeId);
    void this.router.navigate([newNode.id], { relativeTo: this.activatedRoute });
    this.workspace.setSelectedDerivedNodeId(newNode.id);
  }

  protected async handleDuplicateNode(): Promise<void> {
    const nodeId: string | undefined = this.selectedContextItem()?.id;
    if (!nodeId) return;
  }

  protected async handleDeleteNode(): Promise<void> {
    const selectedMenuItem: MenuItem | null = this.selectedContextItem();
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
        await this.workspace.deleteNode(selectedMenuItem.id!);
        void this.router.navigate([], { relativeTo: this.activatedRoute });
      },
    });
  }

  protected handleSelectPanelItem(item: MenuItem): void {
    this.workspace.setSelectedDerivedNodeId(item.id ?? '');
    void this.router.navigate([item.id], { relativeTo: this.activatedRoute });
  }

  protected handleContextMenu($event: Event, clickedItem: MenuItem): void {
    this.selectedContextItem.set(clickedItem);

    this.contextMenu.set(
      this.staticContextMenu.map(
        (item: MenuItem): MenuItem => ({
          ...item,
          label: item.label?.replace('%s', clickedItem.label ?? 'Node'),
        }),
      ),
    );

    this.contextMenuRef()?.show($event);
  }
}
