import { effect, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { LocalStorageService } from '../services/local-storage.service';

export enum APP_THEME {
  LIGHT = 'light',
  DARK = 'dark',
}

interface State {
  theme: APP_THEME;
}

const defaultState: State = {
  theme: APP_THEME.LIGHT,
};

@Injectable({
  providedIn: 'root',
})
export class ApplicationState {
  private static readonly STORAGE_KEY: string = 'application';

  private readonly storageService: LocalStorageService = inject(LocalStorageService);
  public readonly state: WritableSignal<State> = signal({ ...defaultState });

  public constructor() {
    this.state.set(this.storageService.get(ApplicationState.STORAGE_KEY) ?? defaultState);
    effect((): void => this.storageService.set(ApplicationState.STORAGE_KEY, this.state()));
  }

  public setTheme(theme: APP_THEME): void {
    this.state.update((s: State): State => ({ ...s, theme: theme }));
  }
}
