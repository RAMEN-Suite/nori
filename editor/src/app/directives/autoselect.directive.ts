import { Directive, ElementRef, inject, input, afterNextRender, type InputSignal } from '@angular/core';

@Directive({ selector: '[noriAutoselect]', host: { '(focus)': 'onFocus()' } })
export class AutoselectDirective {
  private readonly element: ElementRef<HTMLInputElement> = inject<ElementRef<HTMLInputElement>>(ElementRef);

  public readonly focusOnCreate: InputSignal<boolean> = input(false);

  public constructor() {
    afterNextRender((): void => {
      if (!this.focusOnCreate()) return;

      const input: HTMLInputElement = this.element.nativeElement;
      input.focus();
      // NgModel writes the initial value asynchronously after the input is rendered.
      queueMicrotask((): void => {
        if (input.ownerDocument.activeElement === input) input.select();
      });
    });
  }

  public onFocus(): void {
    this.element.nativeElement.select();
  }
}
