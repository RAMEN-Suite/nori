import { ChangeDetectionStrategy, Component, computed, inject, input, type InputSignal, type Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCopy, LucideGitBranch, LucideTrash } from '@lucide/angular';
import { ModelRef, type NodeSuggestion } from '@ramen-suite/core/model';
import { Button, Card, Tooltip } from '@sushi-kit/angular';
import { NodeEditingService } from '../../../../services/workspace/node-editing.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';

@Component({
  selector: 'app-node-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, Card, Tooltip, LucideCopy, LucideGitBranch, LucideTrash],
  templateUrl: './node-actions.component.html',
  styleUrl: './node-actions.component.scss',
})
export class NodeActionsComponent {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly nodeEditing: NodeEditingService = inject(NodeEditingService);

  public readonly nodeId: InputSignal<string> = input.required<string>();

  protected readonly isLocal: Signal<boolean> = computed((): boolean =>
    this.workspace.view.currentNodesById().has(this.nodeId()),
  );
  protected readonly refinement: Signal<NodeSuggestion | undefined> = computed((): NodeSuggestion | undefined => {
    const reference: string = this.nodeId();
    const nodeId: string = ModelRef.localId(reference);
    const modelId: string | undefined = ModelRef.isQualified(reference)
      ? ModelRef.splitQualified(reference).modelId
      : this.workspace.store.currentModel()?.id;

    return this.workspace.view
      .nodeSuggestions()
      .find((suggestion: NodeSuggestion): boolean => suggestion.nodeId === nodeId && suggestion.modelId === modelId);
  });

  protected handleRemove(): void {
    if (this.isLocal()) this.nodeEditing.confirmRemoval(this.nodeId());
    else this.nodeEditing.confirmCanvasRemoval(this.nodeId());
  }

  protected handleRefine(): void {
    const suggestion: NodeSuggestion | undefined = this.refinement();
    if (suggestion) void this.nodeEditing.refine(suggestion.ref);
  }
}
