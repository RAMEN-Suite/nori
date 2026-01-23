import { Component, inject, model, ModelSignal, signal, WritableSignal } from '@angular/core';
import { PatchNode } from '../../../../../core/handler/GModelMutations';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { Fieldset } from 'primeng/fieldset';
import { GAttribute } from '../../../../../core/models/GModel';
import { NodeAttributeComponent } from './node-attribute/node-attribute.component';

@Component({
  selector: 'app-node-attributes',
  imports: [Fieldset, NodeAttributeComponent],
  templateUrl: './node-attributes.component.html',
  styleUrl: './node-attributes.component.scss',
})
export class NodeAttributesComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  public draftNode: ModelSignal<PatchNode> = model({});
  public attributes: WritableSignal<GAttribute[]> = signal([]);
}
