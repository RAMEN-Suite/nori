import { inject, Injectable } from '@angular/core';
import { WorkspaceStoreService } from './workspace/workspace-store.service';
import { WorkspaceViewService } from './workspace/workspace-view.service';
import { WorkspaceActionService } from './workspace/workspace-action.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  public readonly store: WorkspaceStoreService = inject(WorkspaceStoreService);
  public readonly view: WorkspaceViewService = inject(WorkspaceViewService);
  public readonly actions: WorkspaceActionService = inject(WorkspaceActionService);
}
