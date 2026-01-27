import { Component, inject, input, InputSignal } from '@angular/core';
import { GRelation } from '../../../../../../core/models/GModel';
import { Button } from 'primeng/button';
import { WorkspaceService } from '../../../../../../services/workspace/workspace.service';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'app-node-relation',
  imports: [Button, Tooltip],
  templateUrl: './node-relation.component.html',
  styleUrl: './node-relation.component.scss',
})
export class NodeRelationComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  public relation: InputSignal<GRelation | undefined> = input();
  public isIncoming: InputSignal<boolean> = input(true);

  protected resolveNode(nodeId: string): string {
    return this.workspace.view.currentNodesById().get(nodeId)?.name ?? 'Unknown';
  }
}
