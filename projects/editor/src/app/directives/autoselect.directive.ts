import { Directive, ElementRef, inject } from '@angular/core';

@Directive({
  selector: '[autoselect]',
  host: { '(focus)': 'onFocus()' },
})
export class AutoselectDirective {
  private elementRef: ElementRef = inject(ElementRef);

  public onFocus(): void {
    this.elementRef.nativeElement.select();
  }
}
