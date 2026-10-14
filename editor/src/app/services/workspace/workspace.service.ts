import { inject, Injectable } from '@angular/core';
import { WorkspaceStore } from '../../states/workspace.store';
import { WorkspaceQueriesService } from './workspace-queries.service';
import { WorkspaceActionsService } from './workspace-actions.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  public readonly store: WorkspaceStore = inject(WorkspaceStore);
  public readonly queries: WorkspaceQueriesService = inject(WorkspaceQueriesService);
  public readonly actions: WorkspaceActionsService = inject(WorkspaceActionsService);
}
