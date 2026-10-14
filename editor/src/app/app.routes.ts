import { Routes } from '@angular/router';
import { HomeScreen } from './view/pages/home-screen/home.screen';
import { WorkspaceScreen } from './view/pages/workspace-screen/workspace.screen';
import { ProjectEntryScreen } from './view/pages/project-entry/project-entry.screen';
import { hasWorkspace } from './guards/workspace.guard';
import { RelationViewComponent } from './view/components/relation-view/relation-view.component';
import { NodeViewComponent } from './view/components/node-view/node-view.component';
import { SlotViewComponent } from './view/components/slot-view/slot-view.component';

export const PARAMETERS: Readonly<{ PROJECT: string; SLOT: string; NODE: string; RELATION: string }> = {
  PROJECT: 'projectId',
  SLOT: 'slotId',
  NODE: 'nodeId',
  RELATION: 'relationId',
};

export const routes: Routes = [
  { path: '', component: HomeScreen },
  { path: 'start', component: ProjectEntryScreen },
  { path: 'open', component: ProjectEntryScreen },
  {
    path: `ws/:${PARAMETERS.PROJECT}`,
    canActivate: [hasWorkspace],
    component: WorkspaceScreen,
    children: [
      {
        path: '',
        component: SlotViewComponent,
      },
      {
        path: `:${PARAMETERS.SLOT}`,
        component: SlotViewComponent,
      },
      {
        path: `:${PARAMETERS.SLOT}/relation/:${PARAMETERS.RELATION}`,
        component: RelationViewComponent,
      },
      {
        path: `:${PARAMETERS.SLOT}/:${PARAMETERS.NODE}`,
        component: NodeViewComponent,
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
