import { Component, effect, inject } from '@angular/core';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';

@Component({
  selector: 'app-node-relations',
  imports: [],
  templateUrl: './node-relations.component.html',
  styleUrl: './node-relations.component.scss',
})
export class NodeRelationsComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  constructor() {
    effect((): void => {
      console.log(this.workspace.view.currentNodeRelations());
    });
  }
}
