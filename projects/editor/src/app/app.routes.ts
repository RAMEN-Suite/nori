import { Routes } from '@angular/router';
import { HomeScreen } from './view/pages/home-screen/home.screen';
import { WorkspaceScreen } from './view/pages/workspace-screen/workspace.screen';
import { StartScreen } from './view/pages/start-screen/start.screen';
import { OpenScreen } from './view/pages/open-screen/open.screen';
import { workspaceGuard } from './guards/workspace.guard';

export const routes: Routes = [
  { path: '', component: HomeScreen },
  { path: 'start', component: StartScreen },
  { path: 'open', component: OpenScreen },
  { path: 'ws/:pid', canActivate: [workspaceGuard], component: WorkspaceScreen },
  { path: '**', redirectTo: '' },
];
