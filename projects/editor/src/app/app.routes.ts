import { Routes } from '@angular/router';
import { HomeScreen } from './pages/home-screen/home.screen';
import { WorkspaceScreen } from './pages/workspace-screen/workspace.screen';
import { StartScreen } from './pages/start-screen/start.screen';
import { OpenScreen } from './pages/open-screen/open.screen';
import { workspaceGuard } from './guards/workspace.guard';

export const routes: Routes = [
  { path: '', component: HomeScreen },
  { path: 'start', component: StartScreen },
  { path: 'open', component: OpenScreen },
  { path: 'ws/:pid', canActivate: [workspaceGuard], component: WorkspaceScreen },
  { path: '**', redirectTo: '' },
];
