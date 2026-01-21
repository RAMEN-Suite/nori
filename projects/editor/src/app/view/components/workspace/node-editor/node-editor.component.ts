import { Component, effect, inject, signal, WritableSignal } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkspaceState } from '../../../../states/workspace.state';
import { PatchNode } from '../../../../core/handler/GModelMutations';
import { NodeBasicsComponent } from './node-basics/node-basics.component';
import { GNode } from '../../../../core/models/GModel';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { ScrollPanel } from 'primeng/scrollpanel';

@Component({
  selector: 'app-node-editor',
  imports: [FormsModule, Button, NodeBasicsComponent, Tab, TabList, TabPanel, TabPanels, Tabs, ScrollPanel],
  providers: [],
  templateUrl: './node-editor.component.html',
  styleUrl: './node-editor.component.scss',
})
export class NodeEditorComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly workspaceState: WorkspaceState = inject(WorkspaceState);

  protected readonly router: Router = inject(Router);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  protected readonly draftNode: WritableSignal<PatchNode> = signal({});

  constructor() {
    effect((): void => {
      const selectedNode: GNode | null = this.workspace.view.selectedWorkNode();
      if (!selectedNode) return;
      this.draftNode.set(structuredClone(selectedNode));
    });
  }

  protected handleCloseView(): void {
    this.workspace.store.setSelectedNodeId(null);
    void this.router.navigate([], { relativeTo: this.activatedRoute });
  }
}
