import { Routes } from '@angular/router';
import { PARAMETERS } from './app-route-parameters';
import { HomeScreen } from './view/screens/home/home.screen';
import { WorkspaceScreen } from './view/screens/workspace/workspace.screen';
import { ProjectEntryScreen } from './view/screens/project-entry/project-entry.screen';
import { hasWorkspace } from './guards/workspace.guard';
import { RelationViewComponent } from './view/components/workspace/inspector/relation-view/relation-view.component';
import { NodeViewComponent } from './view/components/workspace/inspector/node-view/node-view.component';
import { InspectorEmptyComponent } from './view/components/workspace/inspector/empty/inspector-empty.component';

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
        component: InspectorEmptyComponent,
      },
      {
        path: `:${PARAMETERS.LEVEL}`,
        component: InspectorEmptyComponent,
      },
      {
        path: `:${PARAMETERS.LEVEL}/relation/:${PARAMETERS.RELATION}`,
        component: RelationViewComponent,
      },
      {
        path: `:${PARAMETERS.LEVEL}/:${PARAMETERS.NODE}`,
        component: NodeViewComponent,
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
