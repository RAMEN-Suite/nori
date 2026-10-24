import { afterNextRender, effect, DestroyRef, Directive, ElementRef, inject, input, type InputSignal } from '@angular/core';

/** Smoothly resizes a surface to its first child's natural height without stretching its contents. */
@Directive({ selector: '[noriAnimateHeight]' })
export class AnimateHeightDirective {
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  public readonly enabled: InputSignal<boolean> = input(true, { alias: 'noriAnimateHeight' });

  public readonly noriHeightEasing: InputSignal<string> = input('cubic-bezier(0.22, 1, 0.36, 1)');

  private height: number | null = null;
  private animation: Animation | null = null;

  public constructor() {
    effect((): void => {
      if (!this.enabled()) this.animation?.cancel();
    });
    afterNextRender((): void => {
      const content: Element | null = this.element.nativeElement.firstElementChild;
      if (!content) return;
      const observer: ResizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]): void => {
        const entry: ResizeObserverEntry | undefined = entries[0];
        if (entry) this.resize(entry.borderBoxSize[0]?.blockSize ?? content.getBoundingClientRect().height);
      });
      observer.observe(content);
      this.destroyRef.onDestroy((): void => {
        observer.disconnect();
        this.animation?.cancel();
      });
    });
  }

  private resize(contentHeight: number): void {
    const host: HTMLElement = this.element.nativeElement;
    const style: CSSStyleDeclaration = getComputedStyle(host);
    if (style.display === 'none') return;
    const height: number =
      contentHeight +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth) +
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom);
    if (height === this.height) return;

    const previous: number = host.offsetHeight;
    const animate: boolean = this.height !== null && this.enabled() && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.animation?.cancel();
    this.height = height;
    host.style.height = `${height}px`;
    this.animation = animate
      ? host.animate([{ height: `${previous}px` }, { height: `${height}px` }], {
          duration: parseFloat(style.getPropertyValue('--nori-panel-enter-duration')) || 280,
          easing: this.noriHeightEasing(),
        })
      : null;
  }
}
