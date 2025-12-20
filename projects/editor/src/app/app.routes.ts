import { Routes } from '@angular/router';
import { DashboardScreen } from './pages/dashboard/dashboard.screen';
import { EditorScreen } from './pages/editor/editor.screen';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'start' },
  { path: 'start', component: DashboardScreen },
  { path: 'editor', component: EditorScreen },
];
