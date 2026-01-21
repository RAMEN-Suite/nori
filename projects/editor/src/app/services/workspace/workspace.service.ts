import { inject, Injectable } from '@angular/core';
import { WorkspaceStore } from './workspace.store';
import { WorkspaceQueries } from './workspace.queries';
import { WorkspaceActions } from './workspace.actions';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  public readonly store: WorkspaceStore = inject(WorkspaceStore);
  public readonly view: WorkspaceQueries = inject(WorkspaceQueries);
  public readonly actions: WorkspaceActions = inject(WorkspaceActions);
}
