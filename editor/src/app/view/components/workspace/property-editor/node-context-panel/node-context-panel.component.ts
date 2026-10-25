import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideInfo, LucidePencil } from '@lucide/angular';
import { ModelRef, type Node } from '@ramen-suite/core/model';
import { Button } from '@sushi-kit/angular';
import type { NodeDefinition } from '../../../../../models/WorkspaceDetails';
import { DialogService } from '../../../../../services/interaction/dialog.service';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { NodeEditDialog } from '../../../dialogs/node-edit/node-edit.dialog';
import { NodeBasicsComponent } from '../../inspector/node-view/node-basics/node-basics.component';

@Component({
  selector: 'nori-node-context-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, NodeBasicsComponent, Button, LucideInfo, LucidePencil],
  templateUrl: './node-context-panel.component.html',
  styleUrl: './node-context-panel.component.scss',
})
export class NodeContextPanelComponent {
  private readonly dialogs: DialogService = inject(DialogService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly inspect: OutputEmitterRef<NodeDefinition> = output();

  protected readonly refinement: Signal<NodeDefinition | null> = computed(
    () => this.workspace.queries.currentNodeChain().at(-1) ?? null,
  );
  public readonly colour: Signal<string> = computed(() => {
    const node: Node | undefined = this.refinement()?.node;
    if (!node) return 'var(--color-base-content)';
    const base: string = ModelRef.localId(node.superTypes[0] ?? node.id);
    return this.workspace.store.currentNodeColors()[base] ?? 'var(--color-base-content)';
  });

  protected openDetails(): void {
    const node: Node | null = this.workspace.queries.currentNode();
    const reference: string | null = this.workspace.store.currentNodeId();
    if (!node || !reference || this.disabled()) return;
    const editable: boolean = this.workspace.queries.nodeEditable();
    this.dialogs.open(NodeEditDialog, {
      headerKey: editable ? 'editor.editNode' : 'editor.nodeDetails',
      inputValues: { node, reference, editable },
    });
  }
}
