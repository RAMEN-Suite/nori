import { inject, Injectable } from '@angular/core';
import { WorkspaceStore } from './workspace.store';
import { WorkspaceQueries } from './workspace.queries';
import { WorkspaceActions } from './workspace.actions';
import { WorkspaceUtils } from './workspace.utils';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  public readonly store: WorkspaceStore = inject(WorkspaceStore);
  public readonly view: WorkspaceQueries = inject(WorkspaceQueries);
  public readonly actions: WorkspaceActions = inject(WorkspaceActions);
  public readonly utils: WorkspaceUtils = inject(WorkspaceUtils);
}
