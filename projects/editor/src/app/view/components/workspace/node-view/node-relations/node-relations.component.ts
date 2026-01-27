import { Component, effect, inject } from '@angular/core';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { Button } from 'primeng/button';
import { Fieldset } from 'primeng/fieldset';
import { NodeRelationComponent } from './node-relation/node-relation.component';

@Component({
  selector: 'app-node-relations',
  imports: [Button, Fieldset, NodeRelationComponent],
  templateUrl: './node-relations.component.html',
  styleUrl: './node-relations.component.scss',
})
export class NodeRelationsComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  constructor() {
    effect(() => {
      console.log(this.workspace.view.currentBaseRelations());
    });
  }
}
