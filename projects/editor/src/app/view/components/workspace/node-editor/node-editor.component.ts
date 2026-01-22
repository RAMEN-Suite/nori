import { Component, effect, inject, signal, WritableSignal } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { WorkspaceState } from '../../../../states/workspace.state';
import { PatchNode } from '../../../../core/handler/GModelMutations';
import { NodeBasicsComponent } from './node-basics/node-basics.component';
import { GNode } from '../../../../core/models/GModel';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { ScrollPanel } from 'primeng/scrollpanel';
import { NodeAttributesComponent } from './node-attributes/node-attributes.component';
import { NodeRelationsComponent } from './node-relations/node-relations.component';

@Component({
  selector: 'app-node-editor',
  imports: [
    FormsModule,
    Button,
    NodeBasicsComponent,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    ScrollPanel,
    NodeAttributesComponent,
    NodeRelationsComponent,
  ],
  providers: [],
  templateUrl: './node-editor.component.html',
  styleUrl: './node-editor.component.scss',
})
export class NodeEditorComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly workspaceState: WorkspaceState = inject(WorkspaceState);

  protected readonly draftNode: WritableSignal<PatchNode> = signal({});
  protected currentId: string | null = null;

  constructor() {
    effect((): void => {
      const selectedId: string | null = this.workspace.store.selectedNodeId();
      if (!selectedId || selectedId === this.currentId) return;
      this.handleResetView();
    });
  }

  protected handleCloseView(): void {
    this.workspace.store.setSelectedNodeId(null);
  }

  protected async handleSaveView(): Promise<void> {
    const selectedNodeId: string | null = this.workspace.store.selectedNodeId();
    if (!selectedNodeId) return;
    await this.workspace.actions.updateNode(selectedNodeId, this.draftNode());
  }

  protected handleResetView(): void {
    const selectedNode: GNode | null = this.workspace.view.selectedWorkNode();
    if (!selectedNode) return;

    this.draftNode.set(structuredClone(selectedNode));
    this.currentId = selectedNode.id;
    this.workspaceState.setDirty(false);
  }
}
