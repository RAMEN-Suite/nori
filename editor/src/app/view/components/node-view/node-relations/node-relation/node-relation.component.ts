import { ChangeDetectionStrategy, Component, inject, input, type InputSignal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft, LucideArrowRight, LucideTrash } from '@lucide/angular';
import { type Relation } from '@ramen-suite/core/model';
import { Button, Tooltip } from '@sushi-kit/angular';
import { GraphToolsService } from '../../../../../services/workspace/graph-tools.service';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-relation',
  imports: [TranslocoDirective, Button, Tooltip, LucideTrash, LucideArrowLeft, LucideArrowRight],
  templateUrl: './node-relation.component.html',
  styleUrl: './node-relation.component.scss',
})
export class NodeRelationComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly graphTools: GraphToolsService = inject(GraphToolsService);

  public readonly relation: InputSignal<Relation | undefined> = input();
  public readonly isOutgoing: InputSignal<boolean> = input(false);

  protected resolveNode(nodeId: string): string {
    return this.workspace.view.editable()
      ? (this.workspace.store.getDraft().getNode(nodeId)?.name ?? nodeId)
      : (this.workspace.view.currentNodesById().get(nodeId)?.name ?? nodeId);
  }

  protected handleRemoveRelation(): void {
    const relation: Relation | undefined = this.relation();
    if (relation) this.graphTools.remove(relation.id);
  }
}
