import { ChangeDetectionStrategy, Component, input, type InputSignal } from '@angular/core';
import { LucideChevronDown, LucideChevronUp } from '@lucide/angular';

@Component({
  selector: 'nori-scroll-hints',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideChevronDown, LucideChevronUp],
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="scroll-hint scroll-hint-up" [class.is-visible]="up()" data-nori-motion>
      <svg lucideChevronUp class="size-3.5"></svg>
    </div>
    <div class="scroll-hint scroll-hint-down" [class.is-visible]="down()" data-nori-motion>
      <svg lucideChevronDown class="size-3.5"></svg>
    </div>
  `,
  styleUrl: './scroll-hints.component.scss',
})
export class ScrollHintsComponent {
  public readonly up: InputSignal<boolean> = input(false);
  public readonly down: InputSignal<boolean> = input(false);
}
