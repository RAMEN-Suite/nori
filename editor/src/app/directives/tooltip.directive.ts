import { Directive, inject } from '@angular/core';
import { Tooltip } from '@sushi-kit/angular';

@Directive({
  selector: '[noriTooltip]',
  hostDirectives: [
    {
      directive: Tooltip,
      inputs: ['suiTooltip: noriTooltip', 'placement', 'offset', 'disabled: noriTooltipSuspended', 'showDelay', 'hideDelay'],
    },
  ],
})
export class TooltipDirective {}

@Directive({
  selector: '[noriIconTooltip]',
  hostDirectives: [
    {
      directive: Tooltip,
      inputs: ['suiTooltip: noriIconTooltip', 'placement', 'offset', 'disabled: noriTooltipSuspended', 'showDelay', 'hideDelay'],
    },
  ],
  host: { '[attr.aria-label]': 'tooltip.text()' },
})
export class IconTooltipDirective {
  protected readonly tooltip: Tooltip = inject(Tooltip, { self: true });
}
