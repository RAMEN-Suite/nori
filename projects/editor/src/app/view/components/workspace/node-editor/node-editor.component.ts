import { Component, computed, inject, Signal } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace.service';
import { GNode } from '../../../../core/models/GModel';

@Component({
  selector: 'app-node-editor',
  imports: [],
  providers: [],
  templateUrl: './node-editor.component.html',
  styleUrl: './node-editor.component.scss',
})
export class NodeEditorComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected currentNode: Signal<GNode | undefined> = computed((): GNode | undefined => {
    const selectedId: string = this.workspace.selectedDerivedNodeId();
    return this.workspace.draftNodes().find((n: GNode): boolean => n.id === selectedId);
  });

  constructor() {}
}
