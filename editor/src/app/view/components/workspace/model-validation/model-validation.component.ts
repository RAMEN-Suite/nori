import { ChangeDetectionStrategy, Component, inject, type Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideShieldAlert, LucideShieldCheck } from '@lucide/angular';
import { type Diagnostic } from '@ramen-suite/core/model';
import { Button } from '@sushi-kit/angular';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { ShortcutService } from '../../../../services/interaction/shortcut.service';
import { ModelValidationFeedbackService } from '../../../../services/workspace/model/model-validation-feedback.service';

@Component({
  selector: 'nori-model-validation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, TooltipDirective, LucideShieldCheck, LucideShieldAlert],
  templateUrl: './model-validation.component.html',
})
export class ModelValidationComponent {
  protected readonly shortcuts: ShortcutService = inject(ShortcutService);
  private readonly feedback: ModelValidationFeedbackService = inject(ModelValidationFeedbackService);
  protected readonly findings: Signal<readonly Diagnostic[]> = this.feedback.findings;
  protected readonly hasErrors: Signal<boolean> = this.feedback.hasErrors;

  protected handleShowDetails(): void {
    this.feedback.showDetails();
  }
}
