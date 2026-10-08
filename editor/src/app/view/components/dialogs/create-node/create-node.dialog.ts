import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type Signal,
  type WritableSignal,
  input,
  type InputSignal,
  effect,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { FormsModule } from '@angular/forms';
import { Button, Input, Listbox, type ListboxOption } from '@sushi-kit/angular';
import { type Node, type NodeSuggestion } from '@ramen-suite/core/model';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { StorageService } from '../../../../services/storage.service';
import { NavigationService } from '../../../../services/navigation.service';
import { DialogService } from '../../../../services/dialog.service';

@Component({
  selector: 'app-create-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, FormsModule, Button, Input, Listbox],
  templateUrl: './create-node.dialog.html',
})
export class CreateNodeDialog {
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly storage: StorageService = inject(StorageService);
  private readonly navigation: NavigationService = inject(NavigationService);

  public readonly baseNodeId: InputSignal<string | null> = input<string | null>(null);

  protected readonly name: WritableSignal<string> = signal('');
  protected readonly base: WritableSignal<string | null> = signal(null);
  protected readonly choices: Signal<readonly ListboxOption[]> = computed((): readonly ListboxOption[] =>
    this.workspace.view.nodeSuggestions().map(
      (node: NodeSuggestion): ListboxOption => ({
        value: node.ref,
        label: `${node.name} · ${this.storage.modelsById().get(node.modelId)?.name ?? 'Model'}`,
      }),
    ),
  );

  public constructor() {
    effect((): void => this.base.set(this.baseNodeId()));
  }

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
