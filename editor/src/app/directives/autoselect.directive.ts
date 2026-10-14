import { afterNextRender, Directive, ElementRef, inject } from '@angular/core';

/** Focus inputs and select their contents after the initial form value is applied. */
@Directive({ selector: 'input[noriAutoselect]', host: { '(focus)': 'handleFocus()' } })
export class AutoselectDirective {
  private readonly element: ElementRef<HTMLInputElement> = inject<ElementRef<HTMLInputElement>>(ElementRef);

  public constructor() {
    afterNextRender((): void => {
      const input: HTMLInputElement = this.element.nativeElement;
      input.focus();

      queueMicrotask((): void => {
        if (input.ownerDocument.activeElement === input) input.select();
      });
    });
  }

  protected handleFocus(): void {
    this.element.nativeElement.select();
  }
}
