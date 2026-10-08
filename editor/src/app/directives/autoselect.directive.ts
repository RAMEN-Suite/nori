import { Directive, ElementRef, inject } from '@angular/core';

@Directive({ selector: '[appAutoselect]', host: { '(focus)': 'onFocus()' } })
export class AutoselectDirective {
  private readonly element: ElementRef<HTMLInputElement> = inject<ElementRef<HTMLInputElement>>(ElementRef);

  public onFocus(): void {
    this.element.nativeElement.select();
  }
}
