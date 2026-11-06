import { afterNextRender, DestroyRef, inject, Injector, signal, type Signal, type WritableSignal } from '@angular/core';

export class InlineRename<T> {
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly injector: Injector = inject(Injector);
  private readonly saving: WritableSignal<boolean> = signal(false);
  private session: number = 0;
  public readonly draft: WritableSignal<string> = signal('');
  public readonly isSaving: Signal<boolean> = this.saving.asReadonly();

  public constructor(
    private readonly target: WritableSignal<T | null>,
    private readonly context: () => unknown,
    private readonly reportError: (error: unknown) => void,
  ) {}

  public start(target: T, name: string): void {
    this.session++;
    this.draft.set(name);
    this.target.set(target);
  }

  public cancel(): T | null {
    const target: T | null = this.target();
    this.session++;
    this.target.set(null);
    return target;
  }

  public restoreFocus(resolve: () => HTMLElement | undefined | null): void {
    const session: number = this.session;
    const context: unknown = this.context();
    afterNextRender(
      (): void => {
        if (this.session === session && this.context() === context) resolve()?.focus();
      },
      { injector: this.injector },
    );
  }

  public async save(persist: (target: T, name: string) => Promise<unknown>, finish: () => void): Promise<void> {
    const target: T | null = this.target();
    if (target === null || this.isSaving()) return;

    const name: string = this.draft().trim();
    if (!name) {
      finish();
      return;
    }

    const session: number = this.session;
    const context: unknown = this.context();
    this.saving.set(true);
    try {
      await persist(target, name);
      if (!this.destroyRef.destroyed && this.session === session && this.context() === context && this.target() === target) {
        finish();
      }
    } catch (error: unknown) {
      this.reportError(error);
    } finally {
      this.saving.set(false);
    }
  }
}
