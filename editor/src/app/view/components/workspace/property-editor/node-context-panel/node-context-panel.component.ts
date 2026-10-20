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
import { ModelRef, type Node } from '@ramen-suite/core/model';
import { AnimateHeightDirective } from '../../../../../directives/animate-height.directive';
import type { NodeDefinition } from '../../../../../models/WorkspaceDetails';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { NodeBasicsComponent } from '../../inspector/node-view/node-basics/node-basics.component';

@Component({
  selector: 'nori-node-context-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, AnimateHeightDirective, NodeBasicsComponent],
  templateUrl: './node-context-panel.component.html',
  styleUrl: './node-context-panel.component.scss',
})
export class NodeContextPanelComponent {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly animateChanges: InputSignal<boolean> = input(true);
  public readonly tooltipSuspended: InputSignal<boolean> = input(false);
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
}
