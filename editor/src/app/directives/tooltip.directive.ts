import { Directive, ElementRef, inject } from '@angular/core';
import { Tooltip } from '@sushi-kit/angular';
import { DialogService } from '../services/interaction/dialog.service';

/** Use Sushi tooltips without reopening them when a dialog restores focus. */
@Directive({
  selector: '[noriTooltip]',
  hostDirectives: [
    {
      directive: Tooltip,
      inputs: ['suiTooltip: noriTooltip', 'placement', 'offset', 'disabled', 'showDelay', 'hideDelay'],
    },
  ],
  host: { '(focusin)': 'handleFocus()' },
})
export class TooltipDirective {
  private readonly tooltip: Tooltip = inject(Tooltip);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  protected handleFocus(): void {
    if (!this.dialogs.consumeRestoredFocus(this.element.nativeElement)) return;

    queueMicrotask((): void => this.tooltip.hide());
  }
}
