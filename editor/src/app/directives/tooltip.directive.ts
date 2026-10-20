import { Directive } from '@angular/core';
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
