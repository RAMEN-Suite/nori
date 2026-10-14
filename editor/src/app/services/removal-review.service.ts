import { afterNextRender, inject, Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { type RemovalLocation } from '../utils/removal-summary';
import { DialogService, type OpenDialog } from './dialog.service';
import { RunningActionService } from './running-action.service';
import { StorageService } from './storage.service';
import { GraphToolsService } from './workspace/graph-tools.service';

export interface RemovalReviewPosition {
  readonly selection: 'nodes' | 'relations';
  readonly scrollTop: number;
}

interface PausedRemoval {
  readonly dialog: OpenDialog;
  readonly returnUrl: string;
  readonly position: RemovalReviewPosition;
}

@Injectable({ providedIn: 'root' })
export class RemovalReviewService {
  private readonly injector: Injector = inject(Injector);
  private readonly router: Router = inject(Router);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly actions: RunningActionService = inject(RunningActionService);
  private readonly storage: StorageService = inject(StorageService);
  private readonly tools: GraphToolsService = inject(GraphToolsService);
  private inspecting: boolean = false;

  public async inspect(location: RemovalLocation, position: RemovalReviewPosition): Promise<void> {
    const dialog: OpenDialog | null = this.dialogs.current();
    if (!dialog || this.dialogs.pending() || this.inspecting || this.actions.pending()) return;
    this.inspecting = true;
    const review: PausedRemoval = { dialog, position, returnUrl: this.router.url };
    try {
      await this.actions.start({
        kind: 'deletion',
        projectId: location.projectId,
        titleKey: 'editor.runningDeletion',
        descriptionKey: 'editor.runningDeletionHint',
        resume: (signal: AbortSignal): Promise<void> => this.restore(review, signal),
      });
      this.tools.exit();
      this.dialogs.close();
      const url: string = this.router.serializeUrl(
        this.router.createUrlTree(
          location.relationId
            ? ['/ws', location.projectId, location.slot, 'relation', location.relationId]
            : ['/ws', location.projectId, location.slot, location.nodeId],
        ),
      );
      if (this.router.url !== url && !(await this.router.navigateByUrl(url))) await this.actions.resume();
    } catch (error: unknown) {
      this.storage.reportError(error);
      await this.actions.resume();
    } finally {
      this.inspecting = false;
    }
  }

  private async restore(review: PausedRemoval, signal: AbortSignal): Promise<void> {
    if (this.router.url !== review.returnUrl && !(await this.router.navigateByUrl(review.returnUrl)))
      throw new Error('The previous view could not be opened.');
    if (signal.aborted) return;
    const options: unknown = review.dialog.inputs['options'];
    this.dialogs.open(review.dialog.component, {
      header: review.dialog.title,
      headerKey: review.dialog.titleKey ?? undefined,
      width: review.dialog.width ?? undefined,
      inputValues: {
        ...review.dialog.inputs,
        options: { ...(options && typeof options === 'object' ? options : {}), reviewPosition: review.position },
      },
    });
    await new Promise<void>((resolve): void => {
      afterNextRender(
        (): void => {
          afterNextRender(
            (): void => {
              if (!signal.aborted) this.dialogs.detailsOpen.set(true);
              resolve();
            },
            { injector: this.injector },
          );
        },
        { injector: this.injector },
      );
    });
  }
}
