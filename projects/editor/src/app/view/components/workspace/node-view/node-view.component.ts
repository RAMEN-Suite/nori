import { Component, inject } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { NodeBasicsComponent } from './node-basics/node-basics.component';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { ScrollPanel } from 'primeng/scrollpanel';
import { NodeAttributesComponent } from './node-attributes/node-attributes.component';
import { NodeRelationsComponent } from './node-relations/node-relations.component';
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
export class NodeViewComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly navigation: NavigationService = inject(NavigationService);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  protected handleCloseView(): void {
    const selectedSlot: number = this.workspace.store.selectedSlot();
    void this.navigation.navigateToSlot(this.activatedRoute, selectedSlot);
  }
}
