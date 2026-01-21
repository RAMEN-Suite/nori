import { Component, inject, model, ModelSignal } from '@angular/core';
import { PatchNode } from '../../../../../core/handler/GModelMutations';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { Fieldset } from 'primeng/fieldset';

@Component({
  selector: 'app-node-attributes',
  imports: [Fieldset],
  templateUrl: './node-attributes.component.html',
  styleUrl: './node-attributes.component.scss',
})
export class NodeAttributesComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  public draftNode: ModelSignal<PatchNode> = model({});
}
