import { ChangeDetectionStrategy, Component, computed, inject, signal, type Signal, type WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button, Input, SelectButton, type SelectButtonOption } from '@sushi-kit/angular';
import { type Node, type NodeSuggestion } from '@ramen-suite/core/model';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { StorageService } from '../../../../services/storage.service';
import { NavigationService } from '../../../../services/navigation.service';
import { DialogService } from '../../../../services/dialog.service';

@Component({
  selector: 'app-create-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, Input, SelectButton],
  templateUrl: './create-node.dialog.html',
})
export class CreateNodeDialog {
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly storage: StorageService = inject(StorageService);
  private readonly navigation: NavigationService = inject(NavigationService);

  protected readonly name: WritableSignal<string> = signal('');
  protected readonly base: WritableSignal<string | null> = signal(null);
  protected readonly choices: Signal<readonly SelectButtonOption[]> = computed((): readonly SelectButtonOption[] =>
    this.workspace.view.nodeSuggestions().map(
      (node: NodeSuggestion): SelectButtonOption => ({
        value: node.ref,
        label: `${node.name} · ${this.storage.modelsById().get(node.modelId)?.name ?? 'Model'}`,
      }),
    ),
  );

  protected handleBase(value: unknown): void {
    this.base.set(typeof value === 'string' ? value : null);
  }

  protected async handleCreate(): Promise<void> {
    const base: string | null = this.base();
    const name: string = this.name().trim();
    if (!base || !name) return;

    await this.dialogs.run(async (): Promise<void> => {
      const node: Node = await this.workspace.actions.createNode({ name, baseNodeId: base });
      await this.navigation.navigateToNode(this.workspace.store.currentSlot(), node.id);
    });
  }
}
