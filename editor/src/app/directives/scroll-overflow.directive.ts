import { afterNextRender, DestroyRef, Directive, ElementRef, inject, signal, type WritableSignal } from '@angular/core';

@Directive({
  selector: '[appScrollOverflow]',
  exportAs: 'scrollOverflow',
  host: { '(scroll)': 'measure()' },
})
export class ScrollOverflowDirective {
  public readonly overflowing: WritableSignal<boolean> = signal(false);
  public readonly canScrollUp: WritableSignal<boolean> = signal(false);
  public readonly canScrollDown: WritableSignal<boolean> = signal(false);

  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  public constructor() {
    afterNextRender((): void => {
      const host: HTMLElement = this.element.nativeElement;
      const resize: ResizeObserver = new ResizeObserver((): void => this.measure());
      const observeContent: () => void = (): void => {
        resize.disconnect();
        resize.observe(host);
        for (const child of Array.from(host.children)) resize.observe(child);
        this.measure();
      };
      const mutations: MutationObserver = new MutationObserver(observeContent);
      mutations.observe(host, { childList: true, subtree: true, characterData: true });
      observeContent();
      this.destroyRef.onDestroy((): void => {
        resize.disconnect();
        mutations.disconnect();
      });
    });
  }

  protected measure(): void {
    const host: HTMLElement = this.element.nativeElement;
    const maximum: number = host.scrollHeight - host.clientHeight;
    const overflowing: boolean = host.clientHeight > 0 && maximum > 1;
    this.overflowing.set(overflowing);
    this.canScrollUp.set(overflowing && host.scrollTop > 1);
    this.canScrollDown.set(overflowing && host.scrollTop < maximum - 1);
  }
}
