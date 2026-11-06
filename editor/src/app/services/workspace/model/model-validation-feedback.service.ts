import { computed, effect, inject, Injectable, signal, untracked, type Signal, type WritableSignal } from '@angular/core';
import { translateSignal } from '@jsverse/transloco';
import { LucideShieldAlert } from '@lucide/angular';
import { type Diagnostic } from '@ramen-suite/core/model';
import { WorkspaceStore } from '../../../states/workspace.store';
import { ModelDiagnosticsDialog } from '../../../view/components/dialogs/model-diagnostics/model-diagnostics.dialog';
import { ActionFeedbackService, type ActionFeedbackOptions } from '../../interaction/action-feedback.service';
import { DialogService } from '../../interaction/dialog.service';
import { ProjectService } from '../../projects/project.service';
import { WorkspaceQueriesService } from './workspace-queries.service';

type ValidationCopy = Pick<ActionFeedbackOptions, 'title' | 'description' | 'label'>;

/** Owns validation feedback across inspector/property views, independently of toolbar lifetime. */
@Injectable({ providedIn: 'root' })
export class ModelValidationFeedbackService {
  private readonly queries: WorkspaceQueriesService = inject(WorkspaceQueriesService);
  private readonly store: WorkspaceStore = inject(WorkspaceStore);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly actions: ActionFeedbackService = inject(ActionFeedbackService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly actionId: WritableSignal<string | null> = signal(null);
  private readonly signature: WritableSignal<string> = signal('');
  private readonly isDismissed: WritableSignal<boolean> = signal(false);

  public readonly findings: Signal<readonly Diagnostic[]> = computed(() => this.queries.validation()?.diagnostics ?? []);
  public readonly hasErrors: Signal<boolean> = computed(() => this.findings().some((finding) => finding.severity === 'error'));

  private readonly activeFindings: Signal<readonly Diagnostic[]> = computed((): readonly Diagnostic[] => {
    const projectId: string | null = this.projects.loadedProjectId();
    return projectId && projectId === this.projects.selectedProjectId() ? this.findings() : [];
  });
  private readonly title: Signal<string> = translateSignal('editor.validationActionTitle');
  private readonly label: Signal<string> = translateSignal('editor.showFindings');
  private readonly description: Signal<string> = translateSignal(
    computed((): string => (this.activeFindings().length === 1 ? 'editor.validationSummarySingle' : 'editor.validationSummary')),
    computed((): { count: number } => ({ count: this.activeFindings().length })),
  );

  public constructor() {
    effect((): void => {
      const projectId: string | null = this.projects.loadedProjectId();
      const findings: readonly Diagnostic[] = this.activeFindings();
      const signature: string = JSON.stringify([projectId, this.store.currentModel()?.id, findings]);
      const copy: ValidationCopy = { title: this.title(), description: this.description(), label: this.label() };
      untracked((): void => this.synchronise(signature, findings, copy));
    });
  }

  public showDetails(): void {
    this.dialogs.open(ModelDiagnosticsDialog, { size: 'compact', headerKey: 'editor.validationTitle' });
  }

  private synchronise(signature: string, findings: readonly Diagnostic[], copy: ValidationCopy): void {
    if (signature !== this.signature()) {
      this.signature.set(signature);
      this.isDismissed.set(false);
    }
    if (!findings.length || this.isDismissed()) {
      const actionId: string | null = this.actionId();
      if (actionId) this.actions.release(actionId);
      this.actionId.set(null);
      return;
    }
    this.actionId.set(
      this.actions.publish({
        owner: 'model-validation',
        icon: LucideShieldAlert.icon,
        severity: findings.some((finding) => finding.severity === 'error') ? 'error' : 'warning',
        ...copy,
        run: (): void => this.showDetails(),
        cancel: (): void => {
          this.isDismissed.set(true);
          this.actionId.set(null);
        },
      }),
    );
  }
}
