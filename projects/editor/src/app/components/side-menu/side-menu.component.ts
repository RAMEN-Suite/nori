import { Component, effect, inject, signal, WritableSignal } from '@angular/core';
import { WorkspaceService } from '../../services/workspace.service';
import { PanelMenu } from 'primeng/panelmenu';
import { MenuItem } from 'primeng/api';
import { GNode } from '../../models/GModel';
import { IftaLabel } from 'primeng/iftalabel';
import { InputText } from 'primeng/inputtext';
import { ScrollPanel } from 'primeng/scrollpanel';

@Component({
  selector: 'app-side-menu',
  imports: [PanelMenu, IftaLabel, InputText, ScrollPanel],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
})
export class SideMenuComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected sideMenuItems: WritableSignal<MenuItem[]> = signal([]);

  constructor() {
    effect((): void => {
      this.sideMenuItems.set(this.createSideMenu());
    });
  }

  private createSideMenu(): MenuItem[] {
    const baseNodes: GNode[] = this.workspace.baseNodes();
    const menuItems: MenuItem[] = [];

    for (const node of baseNodes) {
      menuItems.push({
        label: node.name,
        items: this.createSubMenu(node.id),
      });
    }

    return menuItems;
  }

  private createSubMenu(nodeId: string): MenuItem[] {
    const derivedNodes: GNode[] = this.workspace.filterDerivedNodes(nodeId)();
    const menuItems: MenuItem[] = [];

    for (const node of derivedNodes) {
      menuItems.push({
        label: node.name,
      });
    }

    return menuItems;
  }
}
