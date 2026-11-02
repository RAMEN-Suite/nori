import { ChangeDetectionStrategy, Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import {
  LucideCircleCheck,
  LucideCircleX,
  LucideDynamicIcon,
  LucideInfo,
  LucideTriangleAlert,
  type LucideIconData,
} from '@lucide/angular';
import { type FeedbackKind, type FeedbackSeverity } from '../../../../models/Feedback';

/** Shared feedback presentation; consumers own placement, lifetime and actions. */
@Component({
  selector: 'nori-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideDynamicIcon],
  template: `
    <div
      class="feedback-frame"
      [attr.data-kind]="kind()"
      [attr.data-severity]="severity()"
      [attr.role]="
        kind() === 'action'
          ? 'region'
          : kind() === 'status' && (severity() === 'error' || severity() === 'warning')
            ? 'alert'
            : 'status'
      "
      [attr.aria-label]="kind() === 'action' ? title() : null"
      aria-atomic="true"
    >
      <span class="feedback-icon" aria-hidden="true"><svg [lucideIcon]="resolvedIcon()" class="size-4"></svg></span>
      <div class="feedback-content">
        <strong class="feedback-title" [attr.role]="kind() === 'action' ? 'status' : null">{{ title() }}</strong>
        @if (description()) {
          <span class="feedback-description">{{ description() }}</span>
        }
      </div>
      @if (kind() !== 'hint') {
        <div class="feedback-actions"><ng-content select="[feedbackActions]" /></div>
      }
    </div>
  `,
  styleUrl: './feedback.component.scss',
})
export class FeedbackComponent {
  public readonly kind: InputSignal<FeedbackKind> = input.required();
  public readonly severity: InputSignal<FeedbackSeverity> = input<FeedbackSeverity>('info');
  public readonly title: InputSignal<string> = input.required();
  public readonly description: InputSignal<string> = input('');
  public readonly icon: InputSignal<LucideIconData | undefined> = input<LucideIconData>();
  private readonly statusIcons: Readonly<Record<FeedbackSeverity, LucideIconData>> = {
    error: LucideCircleX.icon,
    warning: LucideTriangleAlert.icon,
    info: LucideInfo.icon,
    success: LucideCircleCheck.icon,
  };
  protected readonly resolvedIcon: Signal<LucideIconData> = computed(() => this.icon() ?? this.statusIcons[this.severity()]);
}
