import { type Routes } from '@angular/router';
import { PARAMETERS } from './app-route-parameters';
import { hasWorkspace } from './guards/workspace.guard';
import { RelationViewComponent } from './view/components/workspace/inspector/relation-view/relation-view.component';
import { NodeViewComponent } from './view/components/workspace/inspector/node-view/node-view.component';
import { InspectorEmptyComponent } from './view/components/workspace/inspector/empty/inspector-empty.component';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./view/screens/home/home.screen').then((module) => module.HomeScreen) },
  {
    path: 'start',
    loadComponent: () => import('./view/screens/project-entry/project-entry.screen').then((module) => module.ProjectEntryScreen),
  },
  {
    path: 'open',
    loadComponent: () => import('./view/screens/project-entry/project-entry.screen').then((module) => module.ProjectEntryScreen),
  },
  {
    path: `ws/:${PARAMETERS.PROJECT}`,
    canActivate: [hasWorkspace],
    loadComponent: () => import('./view/screens/workspace/workspace.screen').then((module) => module.WorkspaceScreen),
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
