import { computed, inject, Injectable, type Signal } from '@angular/core';
import { ProjectService } from '../projects/project.service';
import { WorkspaceStore } from '../../states/workspace.store';
import { WorkspaceQueriesService } from './model/workspace-queries.service';
import { WorkspaceActionsService } from './model/workspace-actions.service';

export interface WorkspaceContext {
  readonly projectId: string;
  readonly modelId: string;
}

/** Provides components with one entry point to workspace state, queries and actions. */
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly projects: ProjectService = inject(ProjectService);
  public readonly store: WorkspaceStore = inject(WorkspaceStore);
  public readonly queries: WorkspaceQueriesService = inject(WorkspaceQueriesService);
  public readonly actions: WorkspaceActionsService = inject(WorkspaceActionsService);

  public readonly context: Signal<WorkspaceContext | null> = computed((): WorkspaceContext | null => {
    const projectId: string | null = this.projects.loadedProjectId();
    const modelId: string | undefined = this.store.currentModel()?.id;
    return projectId && projectId === this.projects.selectedProjectId() && modelId ? { projectId, modelId } : null;
  });

  public isCurrent(context: WorkspaceContext): boolean {
    const current: WorkspaceContext | null = this.context();
    return current?.projectId === context.projectId && current.modelId === context.modelId;
  }
}
