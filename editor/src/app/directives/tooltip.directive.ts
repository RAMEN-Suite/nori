import { Directive, effect, ElementRef, inject, input, type InputSignal } from '@angular/core';
import { MenuTrigger, Tooltip } from '@sushi-kit/angular';
import { DialogService } from '../services/interaction/dialog.service';

/** Dismisses activated tooltips and suppresses reopening while restoring action focus. */
@Directive({
  selector: '[noriTooltip]',
  hostDirectives: [
    {
      directive: Tooltip,
      inputs: ['suiTooltip: noriTooltip', 'placement', 'offset', 'disabled', 'showDelay', 'hideDelay'],
    },
  ],
  host: {
    '(focusin)': 'handleFocus()',
    '(mouseenter)': 'handleHover()',
    '(focusout)': 'handleLeave()',
    '(mouseleave)': 'handleLeave()',
    '(click)': 'handleActivation()',
  },
})
export class TooltipDirective {
  private readonly tooltip: Tooltip = inject(Tooltip);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly menuTrigger: MenuTrigger | null = inject(MenuTrigger, { optional: true, self: true });

  public readonly suspended: InputSignal<boolean> = input(false, { alias: 'noriTooltipSuspended' });

  private suppressTooltip: boolean = false;

  public constructor() {
    effect((): void => {
      if (this.suspended() || this.menuTrigger?.menu().isOpen()) this.suppressTooltip = true;
      if (this.suppressTooltip) this.tooltip.hide();
    });
  }

  protected handleFocus(): void {
    const dialogRestored: boolean = this.dialogs.consumeRestoredFocus(this.element.nativeElement);
    if (!dialogRestored && !this.suppressTooltip) return;

    queueMicrotask((): void => this.tooltip.hide());
  }

  protected handleHover(): void {
    if (this.suppressTooltip) queueMicrotask((): void => this.tooltip.hide());
  }

  protected handleLeave(): void {
    if (!this.suspended() && !this.menuTrigger?.menu().isOpen()) this.suppressTooltip = false;
  }

  protected handleActivation(): void {
    this.suppressTooltip = true;
    queueMicrotask((): void => this.tooltip.hide());
  }
}
