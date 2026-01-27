import { Component, inject } from '@angular/core';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { Button } from 'primeng/button';
import { Fieldset } from 'primeng/fieldset';

@Component({
  selector: 'app-node-relations',
  imports: [Button, Fieldset],
  templateUrl: './node-relations.component.html',
  styleUrl: './node-relations.component.scss',
})
export class NodeRelationsComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
}
