import {
  Component,
  computed,
  inject,
  OnInit,
  Signal,
  signal,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { WorkspaceService } from '../../../services/workspace.service';
import { PanelMenu } from 'primeng/panelmenu';
import { GNode } from '../../../models/GModel';
import { IftaLabel } from 'primeng/iftalabel';
import { InputText } from 'primeng/inputtext';
import { ScrollPanel } from 'primeng/scrollpanel';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { Tooltip } from 'primeng/tooltip';
import { ContextMenu } from 'primeng/contextmenu';
import { FormsModule } from '@angular/forms';
import { ValidationResult } from '../../../core/validation/ModelValidator';
import { MenuItem } from 'primeng/api';

interface SideMenuItem extends MenuItem {
  automationId?: string;
  parentId?: string;
  hasErrors?: boolean;
  button?: string;
  isCategory?: boolean;
}

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

  protected staticContextMenu: SideMenuItem[] = [];
  protected readonly contextMenu: WritableSignal<SideMenuItem[]> = signal([]);
  protected selectedContextItem: SideMenuItem | undefined;

  protected readonly searchInput: WritableSignal<string> = signal('');
  protected readonly sideMenuItems: Signal<SideMenuItem[]> = computed((): SideMenuItem[] => {
    return this.createSideMenu();
  });

  protected readonly filteredMenuItems: Signal<SideMenuItem[]> = computed((): SideMenuItem[] => {
    return this.filterMenuItems();
  });

  protected readonly erroredRefs: Signal<ReadonlySet<string>> = computed(() => {
    const validation: ValidationResult = this.workspace.validation();
    if (!validation.hasErrors) return new Set<string>();

    const erroredSet = new Set<string>();
    for (const diagnostic of validation.diagnostics) {
      if (diagnostic.severity !== 'error') continue;
      if (!diagnostic.ref) continue;
      erroredSet.add(diagnostic.ref);
    }

    return erroredSet;
  });

  @ViewChild('contextMenuRef') contextMenuRef: ContextMenu | undefined;

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
        command: (): void => {},
      },
    ];
  }

  private createSideMenu(): SideMenuItem[] {
    const baseNodes: GNode[] = this.workspace.baseNodes();
    const menuItems: SideMenuItem[] = [];

    for (const node of baseNodes) {
      const subMenu: SideMenuItem[] = this.createSubMenu(node.id);

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

  private createSubMenu(baseId: string): SideMenuItem[] {
    const derivedNodes: GNode[] = this.workspace.filterDerivedNodes(baseId)();
    const errored: ReadonlySet<string> = this.erroredRefs();

    return derivedNodes.map((derived: GNode): SideMenuItem => {
      return {
        label: derived.name,
        automationId: derived.id,
        parentId: baseId,
        hasErrors: this.nodeHasErrors(derived.id, errored),
      };
    });
  }

  private nodeHasErrors(nodeId: string, erroredRefs: ReadonlySet<string>): boolean {
    for (const ref of erroredRefs) {
      if (ref === nodeId) return true;
      const parts: string[] = ref.split('_');
      if (parts.includes(nodeId)) return true;
    }
    return false;
  }

  private filterMenuItems(): SideMenuItem[] {
    const searchQuery: string = this.searchInput().trim().toLowerCase();
    const sideMenu: SideMenuItem[] = this.sideMenuItems();

    if (!searchQuery) return sideMenu;
    const clonedMenu: SideMenuItem[] = structuredClone(sideMenu);

    return clonedMenu.filter((baseNode: SideMenuItem): boolean => {
      const baseLabel: string = (baseNode.label ?? '').toLowerCase();
      if (baseLabel.includes(searchQuery)) return true;

      const derived: SideMenuItem[] = baseNode.items ?? [];
      const filteredDerived: SideMenuItem[] = derived.filter((node: SideMenuItem): boolean =>
        (node.label ?? '').toLowerCase().includes(searchQuery),
      );

      baseNode.items = filteredDerived;
      return filteredDerived.length > 0;
    });
  }

  protected handleContextMenu($event: Event, clickedItem: SideMenuItem): void {
    this.selectedContextItem = clickedItem;

    this.contextMenu.set(
      this.staticContextMenu.map(
        (item: SideMenuItem): SideMenuItem => ({
          ...item,
          label: item.label?.replace('%s', clickedItem.label ?? 'Node'),
        }),
      ),
    );

    this.contextMenuRef?.show($event);
  }
}
