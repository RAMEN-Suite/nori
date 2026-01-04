import { Routes } from '@angular/router';
import { HomeScreen } from './pages/home/home.screen';
import { WorkspaceScreen } from './pages/workspace/workspace.screen';

export const routes: Routes = [
  { path: '', component: HomeScreen },
  { path: 'ws', component: WorkspaceScreen },
  { path: '**', redirectTo: '' },
];
