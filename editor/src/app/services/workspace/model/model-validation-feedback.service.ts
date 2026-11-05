import { computed, effect, inject, Injectable, signal, untracked, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LucideShieldAlert } from '@lucide/angular';
import { type Diagnostic } from '@ramen-suite/core/model';
import { ApplicationState } from '../../../states/application.state';
import { WorkspaceStore } from '../../../states/workspace.store';
import { ModelDiagnosticsDialog } from '../../../view/components/dialogs/model-diagnostics/model-diagnostics.dialog';
import { ActionFeedbackService } from '../../interaction/action-feedback.service';
import { DialogService } from '../../interaction/dialog.service';
import { ProjectService } from '../../projects/project.service';
import { WorkspaceQueriesService } from './workspace-queries.service';

/** Owns validation feedback across inspector/property views, independently of toolbar lifetime. */
@Injectable({ providedIn: 'root' })
export class ModelValidationFeedbackService {
  private readonly queries: WorkspaceQueriesService = inject(WorkspaceQueriesService);
  private readonly store: WorkspaceStore = inject(WorkspaceStore);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly actions: ActionFeedbackService = inject(ActionFeedbackService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly actionId: WritableSignal<string | null> = signal(null);
  private readonly signature: WritableSignal<string> = signal('');
  private readonly dismissed: WritableSignal<boolean> = signal(false);

  public readonly findings: Signal<readonly Diagnostic[]> = computed(() => this.queries.validation()?.diagnostics ?? []);
  public readonly hasErrors: Signal<boolean> = computed(() => this.findings().some((finding) => finding.severity === 'error'));

  public constructor() {
    effect((): void => {
      this.appearance.language();
      const projectId: string | null = this.projects.loadedProjectId();
      const active: boolean = projectId !== null && projectId === this.projects.selectedProjectId();
      const findings: readonly Diagnostic[] = active ? this.findings() : [];
      const signature: string = JSON.stringify([projectId, this.store.currentModel()?.id, findings]);
      untracked((): void => this.synchronise(signature, findings));
    });
  }

  public showDetails(): void {
    this.dialogs.open(ModelDiagnosticsDialog, { size: 'compact', headerKey: 'editor.validationTitle' });
  }

  private synchronise(signature: string, findings: readonly Diagnostic[]): void {
    if (signature !== this.signature()) {
      this.signature.set(signature);
      this.dismissed.set(false);
    }
    if (!findings.length || this.dismissed()) {
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
        title: this.translations.translate('editor.validationActionTitle'),
        description: this.translations.translate(
          findings.length === 1 ? 'editor.validationSummarySingle' : 'editor.validationSummary',
          {
            count: findings.length,
          },
        ),
        label: this.translations.translate('editor.showFindings'),
        run: (): void => this.showDetails(),
        cancel: (): void => {
          this.dismissed.set(true);
          this.actionId.set(null);
        },
      }),
    );
  }
}
