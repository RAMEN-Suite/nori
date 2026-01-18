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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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
  providers: [RouterLink],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
})
export class SideMenuComponent implements OnInit {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly router: Router = inject(Router);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

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

  private createSideMenu(): MenuItem[] {
    const errored: ReadonlySet<string> = this.erroredRefs();
    const baseNodes: GNode[] = this.workspace.baseNodes();
    const menuItems: MenuItem[] = [];

    for (const node of baseNodes) {
      const subMenu: MenuItem[] = this.createSubMenu(node.id, errored);

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

  private createSubMenu(baseId: string, errored: ReadonlySet<string>): MenuItem[] {
    const derivedNodes: GNode[] = this.workspace.filterDerivedNodes(baseId)();
    const currentItemId: string | null = this.workspace.selectedDerivedNodeId();

    return derivedNodes.map((derived: GNode): MenuItem => {
      return {
        id: derived.id,
        label: derived.name,
        parentId: baseId,
        isActive: currentItemId && currentItemId === derived.id,
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

  protected async handleSelectPanelItem(item: MenuItem): Promise<void> {
    this.workspace.setDerivedNodeId(item.id ?? '');
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
