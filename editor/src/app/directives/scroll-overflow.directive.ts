import { afterNextRender, DestroyRef, Directive, ElementRef, inject, signal, type WritableSignal } from '@angular/core';

@Directive({ selector: '[appScrollOverflow]', exportAs: 'scrollOverflow' })
export class ScrollOverflowDirective {
  public readonly overflowing: WritableSignal<boolean> = signal(false);

  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  public constructor() {
    afterNextRender((): void => {
      const host: HTMLElement = this.element.nativeElement;
      const observer: ResizeObserver = new ResizeObserver((): void => {
        this.overflowing.set(host.scrollHeight > host.clientHeight + 1);
      });
      observer.observe(host);
      for (const child of Array.from(host.children)) observer.observe(child);
      this.destroyRef.onDestroy((): void => observer.disconnect());
    });
  }
}
