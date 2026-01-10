import { Routes } from '@angular/router';
import { HomeScreen } from './pages/home-screen/home.screen';
import { WorkspaceScreen } from './pages/workspace-screen/workspace.screen';
import { StartScreen } from './pages/start-screen/start.screen';

export const routes: Routes = [
  { path: '', component: HomeScreen },
  { path: 'start', component: StartScreen },
  { path: 'ws/:pid', component: WorkspaceScreen },
  { path: '**', redirectTo: '' },
];
