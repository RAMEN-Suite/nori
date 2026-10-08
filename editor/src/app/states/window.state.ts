import { computed, effect, inject, Injectable, signal, type Signal, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { Title } from '@angular/platform-browser';

interface State {
  title: string;
}

const defaultState: State = {
  title: '',
};

@Injectable({
  providedIn: 'root',
})
export class WindowState {
  private readonly titleService: Title = inject(Title);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly homeTitle: Signal<string> = toSignal(this.translations.selectTranslate<string>('home.windowTitle'), {
    initialValue: 'Nori',
  });
  public readonly state: WritableSignal<State> = signal({ ...defaultState });

  public readonly fullTitle: Signal<string> = computed((): string => {
    const title: string = this.state().title;
    return title ? `${title} — Nori` : this.homeTitle();
  });

  public constructor() {
    effect((): void => {
      this.titleService.setTitle(this.fullTitle());
    });
  }

  public setTitle(title: string): void {
    this.state.update((s: State): State => ({ ...s, title }));
  }
}
