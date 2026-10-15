import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { LucideEraser } from '@lucide/angular';
import { type WorkspaceLocation } from '../../../models/WorkspaceLocation';
import { NavigationService } from '../../interaction/navigation.service';
import { DialogService, type OpenDialog } from '../../interaction/dialog.service';
import { RunningActionService } from './running-action.service';
import { ProjectService } from '../../projects/project.service';
import { GraphToolsService } from '../editing/graph-tools.service';

export interface RemovalReviewPosition {
  readonly selection: 'nodes' | 'relations' | 'levels';
  readonly scrollTop: number;
}

interface PausedRemoval {
  readonly dialog: OpenDialog;
  readonly returnUrl: string;
  readonly position: RemovalReviewPosition;
}

/** Pauses a removal confirmation for inspection and restores its route and selected detail list. */
@Injectable({ providedIn: 'root' })
export class RemovalReviewService {
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly router: Router = inject(Router);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly actions: RunningActionService = inject(RunningActionService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly tools: GraphToolsService = inject(GraphToolsService);

  private inspecting: boolean = false;

  public async inspect(location: WorkspaceLocation, position: RemovalReviewPosition): Promise<void> {
    const dialog: OpenDialog | null = this.dialogs.current();
    if (!dialog || this.dialogs.pending() || this.inspecting || this.actions.pending()) return;
    this.inspecting = true;
    let paused: boolean = false;
    const review: PausedRemoval = { dialog, position, returnUrl: this.router.url };
    try {
      paused = await this.actions.start({
        icon: LucideEraser.icon,
        severity: 'error',
        projectId: location.projectId,
        titleKey: 'editor.runningDeletion',
        descriptionKey: 'editor.runningDeletionHint',
        resume: (signal: AbortSignal): Promise<void> => this.restore(review, signal),
      });
      if (!paused) return;
      this.tools.exit();
      this.dialogs.close();
      if (!(await this.navigation.navigateToLocation(location))) await this.actions.resume();
    } catch (error: unknown) {
      this.projects.reportError(error);
      if (paused) await this.actions.resume();
    } finally {
      this.inspecting = false;
    }
  }

  private async restore(review: PausedRemoval, signal: AbortSignal): Promise<void> {
    if (!(await this.navigation.navigateToUrl(review.returnUrl))) throw new Error('The previous view could not be opened.');
    if (signal.aborted) return;
    const options: unknown = review.dialog.inputs['options'];
    this.dialogs.open(review.dialog.component, {
      closeOnBackdrop: review.dialog.closeOnBackdrop,
      detailsOpen: true,
      header: review.dialog.title,
      headerKey: review.dialog.titleKey ?? undefined,
      width: review.dialog.width ?? undefined,
      inputValues: {
        ...review.dialog.inputs,
        options: { ...(options && typeof options === 'object' ? options : {}), reviewPosition: review.position },
      },
    });
  }
}
