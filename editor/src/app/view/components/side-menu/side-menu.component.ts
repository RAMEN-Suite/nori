import { ChangeDetectionStrategy, Component, computed, inject, signal, type Signal, type WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button, Input } from '@sushi-kit/angular';
import { type Node, type NodeSuggestion } from '@ramen-suite/core/model';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { StorageService } from '../../../services/storage.service';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  selector: 'app-side-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, Input],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
})
export class SideMenuComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);
  private readonly navigation: NavigationService = inject(NavigationService);
  protected readonly search: WritableSignal<string> = signal('');
  protected readonly nodes: Signal<readonly Node[]> = computed((): readonly Node[] => {
    const query: string = this.search().trim().toLowerCase();
    return this.workspace.view.currentNodes().filter((node: Node): boolean => node.name.toLowerCase().includes(query));
  });
  protected readonly suggestions: Signal<readonly NodeSuggestion[]> = computed((): readonly NodeSuggestion[] => {
    const query: string = this.search().trim().toLowerCase();
    return this.workspace.view
      .nodeSuggestions()
      .filter((node: NodeSuggestion): boolean => node.name.toLowerCase().includes(query));
  });

  protected async handleCreateNode(base: NodeSuggestion): Promise<void> {
    try {
      const node: Node = await this.workspace.actions.createNode({ name: `New${base.name}`, baseNodeId: base.ref });
      await this.navigation.navigateToNode(this.workspace.store.currentSlot(), node.id);
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }

  protected async handleSelect(node: Node): Promise<void> {
    await this.navigation.navigateToNode(this.workspace.store.currentSlot(), node.id);
  }
}
