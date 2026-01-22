import { Component, effect, inject, signal, WritableSignal } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { NodeBasicsComponent } from './node-basics/node-basics.component';
import { GNode } from '../../../../core/models/GModel';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { ScrollPanel } from 'primeng/scrollpanel';
import { NodeAttributesComponent } from './node-attributes/node-attributes.component';
import { NodeRelationsComponent } from './node-relations/node-relations.component';
import { PatchNode } from '../../../../core/handler/GModelMutations';
import { OnDeactivate } from '../../../../guards/workspace.guard';
import { ActivatedRoute } from '@angular/router';
import { NavigationService } from '../../../../services/navigation.service';

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
  templateUrl: './node-view.component.html',
  styleUrl: './node-view.component.scss',
})
export class NodeViewComponent implements OnDeactivate {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly navigation: NavigationService = inject(NavigationService);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  protected readonly draftNode: WritableSignal<PatchNode> = signal({});
  protected readonly isDraftDirty: WritableSignal<boolean> = signal(false);

  protected currentId: string | null = null;

  constructor() {
    effect((): void => {
      const selectedId: string | null = this.workspace.store.selectedNodeId();
      if (!selectedId || selectedId === this.currentId) return;
      this.handleResetView();
    });
  }

  public ngOnDeactivate(): boolean {
    console.log(this.isDraftDirty());
    if (!this.isDraftDirty()) return true;
    return false;
  }

  protected handleCloseView(): void {
    const selectedSlot: number = this.workspace.store.selectedSlot();
    void this.navigation.navigateToSlot(this.activatedRoute, selectedSlot);
  }

  protected async handleSaveView(): Promise<void> {
    const selectedNodeId: string | null = this.workspace.store.selectedNodeId();
    if (!selectedNodeId) return;
    await this.workspace.actions.updateNode(selectedNodeId, this.draftNode());
  }

  protected handleResetView(): void {
    const selectedNode: GNode | null = this.workspace.view.selectedWorkNode();
    if (!selectedNode) return;

    this.draftNode.set({
      name: selectedNode.name,
      attributes: structuredClone(selectedNode.attributes),
      superTypes: structuredClone(selectedNode.superTypes),
    });

    this.currentId = selectedNode.id;
  }
}
