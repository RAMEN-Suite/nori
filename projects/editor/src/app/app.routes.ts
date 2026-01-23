import { Routes } from '@angular/router';
import { HomeScreen } from './view/pages/home-screen/home.screen';
import { WorkspaceScreen } from './view/pages/workspace-screen/workspace.screen';
import { StartScreen } from './view/pages/start-screen/start.screen';
import { OpenScreen } from './view/pages/open-screen/open.screen';
import { hasWorkspace } from './guards/workspace.guard';
import { NodeViewComponent } from './view/components/workspace/node-view/node-view.component';
import { SlotViewComponent } from './view/components/workspace/slot-view/slot-view.component';

export const PARAMETERS = {
  PROJECT: 'projectId',
  SLOT: 'slotId',
  NODE: 'nodeId',
};

export const routes: Routes = [
  { path: '', component: HomeScreen },
  { path: 'start', component: StartScreen },
  { path: 'open', component: OpenScreen },
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
        path: `:${PARAMETERS.SLOT}/:${PARAMETERS.NODE}`,
        component: NodeViewComponent,
      },
    ],
  },
  // todo, add not found screen.
  { path: '**', redirectTo: '' },
];
