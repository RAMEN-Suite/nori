import { computed, effect, inject, Injectable, signal, type Signal, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { Title } from '@angular/platform-browser';

export type WindowIcon = 'network' | 'pencil' | 'folder-plus' | 'folder-open';

interface State {
  title: string;
  titleKey: string | null;
  icon: WindowIcon;
}

const defaultState: State = {
  title: '',
  titleKey: null,
  icon: 'network',
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
    const homeTitle: string = this.homeTitle();
    const { title, titleKey }: State = this.state();
    if (titleKey) return this.translations.translate(titleKey);

    return title || homeTitle;
  });

  public constructor() {
    effect((): void => {
      this.titleService.setTitle(this.fullTitle());
    });
  }

  public setTitle(title: string, icon: WindowIcon = 'network'): void {
    this.state.set({ ...defaultState, title, icon });
  }

  public setTitleKey(titleKey: string, icon: WindowIcon = 'network'): void {
    this.state.set({ ...defaultState, titleKey, icon });
  }
}
