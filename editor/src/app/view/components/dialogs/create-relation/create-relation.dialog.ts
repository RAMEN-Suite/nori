import { ChangeDetectionStrategy, Component, computed, inject, signal, type Signal, type WritableSignal } from '@angular/core';
import { Button, Select, type SelectOption } from '@sushi-kit/angular';
import { type Node, type RelationSuggestion, type RelationInput } from '@ramen-suite/core/model';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { StorageService } from '../../../../services/storage.service';
import { DialogService } from '../../../../services/dialog.service';

@Component({
  selector: 'app-create-relation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Select],
  templateUrl: './create-relation.dialog.html',
  styleUrl: './create-relation.dialog.scss',
})
export class CreateRelationDialog {
  private readonly storage: StorageService = inject(StorageService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly dialogRef: DialogService = inject(DialogService);
  protected readonly direction: WritableSignal<'IN' | 'OUT'> = signal('OUT');
  protected readonly target: WritableSignal<string | null> = signal(null);
  protected readonly relation: WritableSignal<string | null> = signal(null);
  protected readonly targets: Signal<readonly SelectOption[]> = computed((): readonly SelectOption[] =>
    this.workspace.view
      .resolveReachableNodes(this.direction())
      .map((node: Node): SelectOption => ({ label: node.name, value: node.id })),
  );
  protected readonly relations: Signal<readonly RelationSuggestion[]> = computed((): readonly RelationSuggestion[] => {
    const target: string | null = this.target();
    return target ? this.workspace.view.resolveAllowedRelations(target, this.direction()) : [];
  });
  protected readonly relationOptions: Signal<readonly SelectOption[]> = computed((): readonly SelectOption[] =>
    this.relations().map(
      (relation: RelationSuggestion): SelectOption => ({
        label: `${relation.name} · ${this.storage.modelsById().get(relation.modelId)?.name ?? 'Model'}`,
        value: relation.ref,
      }),
    ),
  );

  protected handleDirection(): void {
    this.direction.update((direction: 'IN' | 'OUT'): 'IN' | 'OUT' => (direction === 'OUT' ? 'IN' : 'OUT'));
    this.target.set(null);
    this.relation.set(null);
  }

  protected handleTarget(value: unknown): void {
    this.target.set(typeof value === 'string' ? value : null);
    this.relation.set(this.relations().length === 1 ? (this.relations()[0]?.ref ?? null) : null);
  }

  protected handleRelation(value: unknown): void {
    this.relation.set(typeof value === 'string' ? value : null);
  }

  protected async handleSave(): Promise<void> {
    const current: string | null = this.workspace.store.currentNodeId();
    const target: string | null = this.target();
    const relation: string | null = this.relation();
    if (!current || !target || !relation) return;

    const outgoing: boolean = this.direction() === 'OUT';
    const input: RelationInput = {
      refines: relation,
      from: { nodeId: outgoing ? current : target },
      to: { nodeId: outgoing ? target : current },
    };
    await this.dialogRef.run(async (): Promise<void> => {
      await this.workspace.actions.createRelation(input);
    });
  }
}
