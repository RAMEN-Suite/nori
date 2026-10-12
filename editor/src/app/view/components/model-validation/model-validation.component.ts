import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, untracked, type Signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideShieldCheck } from '@lucide/angular';
import { type Diagnostic } from '@ramen-suite/core/model';
import { Button, ToastService, Tooltip } from '@sushi-kit/angular';
import { ShortcutService } from '../../../services/shortcut.service';
import { DialogService } from '../../../services/dialog.service';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { ModelDiagnosticsDialog } from '../dialogs/model-diagnostics/model-diagnostics.dialog';

@Component({
  selector: 'app-model-validation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, Tooltip, LucideShieldCheck],
  templateUrl: './model-validation.component.html',
})
export class ModelValidationComponent {
  protected readonly shortcuts: ShortcutService = inject(ShortcutService);

  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly toasts: ToastService = inject(ToastService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private toastId: string | null = null;
  private previousFindings: string = '';

  protected readonly findings: Signal<readonly Diagnostic[]> = computed(
    (): readonly Diagnostic[] => this.workspace.view.validation()?.diagnostics ?? [],
  );
  protected readonly hasErrors: Signal<boolean> = computed((): boolean =>
    this.findings().some((finding: Diagnostic): boolean => finding.severity === 'error'),
  );

  public constructor() {
    effect((): void => {
      const findings: readonly Diagnostic[] = this.findings();
      const signature: string = JSON.stringify([this.workspace.store.currentModel()?.id, findings]);
      if (signature === this.previousFindings) return;
      this.previousFindings = signature;
      untracked((): void => this.announce(findings));
    });
    this.destroyRef.onDestroy((): void => this.dismissToast());
  }

  protected handleShowDetails(): void {
    this.dialogs.open(ModelDiagnosticsDialog, { size: 'compact', headerKey: 'editor.validationTitle' });
  }

  private announce(findings: readonly Diagnostic[]): void {
    this.dismissToast();
    if (!findings.length) return;

    this.toastId = this.toasts.show({
      title: this.translations.translate('editor.validationTitle'),
      message: this.translations.translate('editor.validationSummary', { count: findings.length, message: findings[0]?.message }),
      severity: findings.some((finding: Diagnostic): boolean => finding.severity === 'error') ? 'error' : 'warning',
      variant: 'soft',
      action: { label: this.translations.translate('editor.showFindings'), run: (): void => this.handleShowDetails() },
    });
  }

  private dismissToast(): void {
    if (this.toastId) this.toasts.dismiss(this.toastId);
    this.toastId = null;
  }
}
