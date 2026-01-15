import {
  Component,
  computed,
  effect,
  inject,
  OnInit,
  Signal,
  signal,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { WorkspaceService } from '../../../services/workspace.service';
import { PanelMenu } from 'primeng/panelmenu';
import { MenuItem } from 'primeng/api';
import { GNode } from '../../../models/GModel';
import { IftaLabel } from 'primeng/iftalabel';
import { InputText } from 'primeng/inputtext';
import { ScrollPanel } from 'primeng/scrollpanel';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { Tooltip } from 'primeng/tooltip';
import { ContextMenu } from 'primeng/contextmenu';
import { FormsModule } from '@angular/forms';

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
  ],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
})
export class SideMenuComponent implements OnInit {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected contextMenu: MenuItem[] = [];
  protected selectedContextItem: MenuItem | undefined;

  protected sideMenuItems: WritableSignal<MenuItem[]> = signal([]);
  protected readonly searchInput: WritableSignal<string> = signal('');
  protected readonly filteredMenuItems: Signal<MenuItem[]> = computed(() => this.filterMenuItems());

  @ViewChild('contextMenuRef') contextMenuRef: ContextMenu | undefined;

  constructor() {
    effect((): void => {
      this.sideMenuItems.set(this.createSideMenu());
    });
  }

  public ngOnInit(): void {
    this.contextMenu = [
      {
        label: 'Create new Node',
        icon: 'pi pi-plus',
        command: (): void => {},
      },
      {
        separator: true,
      },
      {
        label: 'Delete Node',
        icon: 'pi pi-trash',
        severity: 'error',
        command: (): void => {},
      },
    ];
  }

  private createSideMenu(): MenuItem[] {
    const baseNodes: GNode[] = this.workspace.baseNodes();
    const menuItems: MenuItem[] = [];

    for (const node of baseNodes) {
      const subMenu: MenuItem[] = this.createSubMenu(node.id);

      menuItems.push({
        label: node.name,
        expanded: true,
        items: subMenu,
        badge: `${subMenu.length}`,
        automationId: node.id,
        button: `Create New ${node.name} Node`,
        isCategory: true,
      });
    }

    return menuItems;
  }

  private createSubMenu(baseId: string): MenuItem[] {
    const derivedNodes: GNode[] = this.workspace.filterDerivedNodes(baseId)();
    const menuItems: MenuItem[] = [];

    for (const derived of derivedNodes) {
      menuItems.push({
        label: derived.name,
        automationId: derived.id,
        parentId: baseId,
      });
    }

    return menuItems;
  }

  private filterMenuItems(): MenuItem[] {
    const searchQuery: string = this.searchInput().trim().toLowerCase();
    const sideMenu: MenuItem[] = this.sideMenuItems();

    if (!searchQuery) return sideMenu;
    const clonedMenu: MenuItem[] = structuredClone(sideMenu);

    return clonedMenu.filter((baseNode: MenuItem): boolean => {
      const query: string = searchQuery;
      const baseLabel: string = (baseNode.label ?? '').toLowerCase();

      const baseMatches: boolean = baseLabel.includes(query);
      if (baseMatches) return true;

      const derived: MenuItem[] = baseNode.items ?? [];
      const filteredDerived: MenuItem[] = derived.filter((node: MenuItem): boolean =>
        (node.label ?? '').toLowerCase().includes(query),
      );

      baseNode.items = filteredDerived;
      return filteredDerived.length > 0;
    });
  }

  protected handleContextMenu($event: Event, item: MenuItem): void {
    this.selectedContextItem = item;
    this.contextMenuRef?.show($event);
  }
}
