import { afterNextRender, Directive, ElementRef, inject } from '@angular/core';

/** Focus new inputs and select their contents when focused. */
@Directive({ selector: 'input[noriAutoselect]', host: { '(focus)': 'onFocus()' } })
export class AutoselectDirective {
  private readonly element: ElementRef<HTMLInputElement> = inject<ElementRef<HTMLInputElement>>(ElementRef);

  public constructor() {
    afterNextRender((): void => {
      const input: HTMLInputElement = this.element.nativeElement;
      input.focus();

      // Wait for the initial form value before selecting it.
      queueMicrotask((): void => {
        if (input.ownerDocument.activeElement === input) input.select();
      });
    });
  }

  protected onFocus(): void {
    this.element.nativeElement.select();
  }
}
