import { Component, effect, inject, signal, WritableSignal } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace.service';
import { ScrollPanel } from 'primeng/scrollpanel';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { ActivatedRoute, Router } from '@angular/router';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Panel } from 'primeng/panel';
import { Chip } from 'primeng/chip';
import { Tooltip } from 'primeng/tooltip';
import { Inplace } from 'primeng/inplace';
import { InputText } from 'primeng/inputtext';
import { WorkspaceState } from '../../../../states/workspace.state';

@Component({
  selector: 'app-node-editor',
  imports: [
    ScrollPanel,
    FormsModule,
    Button,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Panel,
    Chip,
    Tooltip,
    Inplace,
    InputText,
  ],
  providers: [],
  templateUrl: './node-editor.component.html',
  styleUrl: './node-editor.component.scss',
})
export class NodeEditorComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly workspaceState: WorkspaceState = inject(WorkspaceState);

  protected readonly router: Router = inject(Router);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  protected readonly isNodeNameActive: WritableSignal<boolean> = signal(false);

  constructor() {
    effect((): void => {
      this.workspace.store.selectedNodeId();
      this.isNodeNameActive.set(false);
    });
  }

  protected handleEditNodeName(): void {
    this.isNodeNameActive.set(!this.isNodeNameActive());
    this.workspaceState.setDirty(true);
  }

  protected handleCloseView(): void {
    this.workspace.store.setSelectedNodeId(null);
    void this.router.navigate([], { relativeTo: this.activatedRoute });
  }
}
