import { inject, Injectable } from '@angular/core';
import { WorkspaceStore } from './workspace.store';
import { WorkspaceView } from './workspace.view';
import { WorkspaceActions } from './workspace.actions';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  public readonly store: WorkspaceStore = inject(WorkspaceStore);
  public readonly view: WorkspaceView = inject(WorkspaceView);
  public readonly actions: WorkspaceActions = inject(WorkspaceActions);
}
