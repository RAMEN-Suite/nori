import { inject, Injectable } from '@angular/core';
import { WorkspaceStore } from './workspace/workspace.store';
import { WorkspaceViewModel } from './workspace/workspace.model';
import { WorkspaceActions } from './workspace/workspace.actions';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  public readonly store: WorkspaceStore = inject(WorkspaceStore);
  public readonly view: WorkspaceViewModel = inject(WorkspaceViewModel);
  public readonly actions: WorkspaceActions = inject(WorkspaceActions);
}
