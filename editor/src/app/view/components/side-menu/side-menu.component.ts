import { ChangeDetectionStrategy, Component, computed, inject, signal, type Signal, type WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button, Input, Sidebar, SidebarItemTemplate, type SidebarGroup, type NavbarItem } from '@sushi-kit/angular';
import { LucideBox, LucidePlus } from '@lucide/angular';
import { type Node } from '@ramen-suite/core/model';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { NavigationService } from '../../../services/navigation.service';
import { DialogService } from '../../../services/dialog.service';
import { CreateNodeDialog } from '../dialogs/create-node/create-node.dialog';

interface NodeItem extends NavbarItem<string> {
  readonly base: string;
}

@Component({
  selector: 'app-side-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, Input, Sidebar, SidebarItemTemplate, LucideBox, LucidePlus],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
})
export class SideMenuComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly dialogs: DialogService = inject(DialogService);
  protected readonly search: WritableSignal<string> = signal('');
  protected readonly groups: Signal<readonly SidebarGroup<NodeItem>[]> = computed((): readonly SidebarGroup<NodeItem>[] => {
    const query: string = this.search().trim().toLowerCase();
    const items: NodeItem[] = this.workspace.view
      .currentNodes()
      .filter((node: Node): boolean => node.name.toLowerCase().includes(query))
      .map(
        (node: Node): NodeItem => ({
          value: node.id,
          label: node.name,
          base: this.workspace.view.resolveNodeBase(node)?.node.name ?? '',
        }),
      );

    return [{ label: 'Nodes', items }];
  });

  protected handleCreate(): void {
    this.dialogs.open(CreateNodeDialog, { header: 'Create node' });
  }

  protected async handleSelect(id: string | number | null): Promise<void> {
    if (typeof id === 'string') await this.navigation.navigateToNode(this.workspace.store.currentSlot(), id);
  }
}
