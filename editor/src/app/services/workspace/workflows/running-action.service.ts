import { computed, effect, inject, Injectable, signal, untracked, type Signal, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideArrowLeft, type LucideIconData } from '@lucide/angular';
import { TranslocoService } from '@jsverse/transloco';
import { ApplicationState } from '../../../states/application.state';
import { ActionFeedbackService } from '../../interaction/action-feedback.service';
import {
  InteractionStateService,
  type InteractionHandle,
  type InteractionState,
} from '../../interaction/interaction-state.service';
import { ProjectService } from '../../projects/project.service';

export interface RunningActionOptions {
  readonly icon: LucideIconData;
  readonly severity: 'error' | 'warning';
  readonly projectId: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly resume: (signal: AbortSignal) => Promise<void>;
}

interface RunningAction extends RunningActionOptions {
  readonly interaction: InteractionHandle;
}

/** Keeps one resumable workflow and invalidates it when its project’s model revision changes. */
@Injectable({ providedIn: 'root' })
export class RunningActionService {
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly feedback: ActionFeedbackService = inject(ActionFeedbackService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly interactions: InteractionStateService = inject(InteractionStateService);
  private feedbackId: string | null = null;

  private readonly active: WritableSignal<RunningAction | null> = signal(null);
  private request: number = 0;
  public readonly current: Signal<RunningAction | null> = this.active.asReadonly();
  public readonly pending: Signal<boolean> = computed((): boolean => {
    const state: InteractionState = this.interactions.current();
    return state.phase === 'executing' && state.id === this.active()?.interaction.id;
  });

  public constructor() {
    this.projects.modelChanges$.pipe(takeUntilDestroyed()).subscribe((projectId: string): void => {
      if (this.active()?.projectId === projectId) this.discard();
    });
    effect((): void => {
      const action: RunningAction | null = this.active();
      const projectId: string | null = this.projects.selectedProjectId();
      this.appearance.language();
      untracked((): void => {
        if (action && action.projectId !== projectId) this.discard();
        else if (action) this.present(action);
      });
    });
  }

  public async start(options: RunningActionOptions): Promise<boolean> {
    this.interactions.assertCanMutate();

    const request: number = ++this.request;
    const revision: string = await this.projects.getProjectRevision(options.projectId);
    if (request !== this.request || this.projects.selectedProjectId() !== options.projectId) return false;

    const interaction: InteractionHandle = this.interactions.beginDecision('removal-review', options.projectId, revision);
    this.discard();
    this.active.set({ ...options, interaction });
    return true;
  }

  public async resume(): Promise<void> {
    const action: RunningAction | null = this.active();
    if (!action || this.pending()) return;

    const state: InteractionState = this.interactions.current();
    if (state.phase !== 'decision' || state.id !== action.interaction.id) return;
    try {
      const completed: boolean = await this.interactions.executeDecision(action.interaction, async (): Promise<void> => {
        const revision: string = await this.projects.getProjectRevision(action.projectId);
        if (this.active() !== action) return;
        if (revision !== state.revision) this.discard();
        else await action.resume(action.interaction.signal);
      });
      if (completed && this.active() === action) this.discard();
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  public cancel(): void {
    if (!this.pending()) this.discard();
  }

  private discard(): void {
    this.request++;
    const action: RunningAction | null = this.active();
    if (action) this.interactions.end(action.interaction);
    this.active.set(null);
    if (this.feedbackId) this.feedback.release(this.feedbackId);
    this.feedbackId = null;
  }

  private present(action: RunningAction): void {
    this.feedbackId = this.feedback.publish({
      owner: 'removal-review',
      icon: action.icon,
      severity: action.severity,
      title: this.translations.translate(action.titleKey),
      description: this.translations.translate(action.descriptionKey),
      label: this.translations.translate('editor.resumeAction'),
      buttonIcon: LucideArrowLeft.icon,
      run: (): Promise<void> => this.resume(),
      cancel: (): void => this.cancel(),
    });
  }
}
