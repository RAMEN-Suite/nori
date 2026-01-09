import { effect, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { LocalStorage } from '../storage/local.storage';

export enum EDITOR_THEME {
  LIGHT = 'light',
  DARK = 'dark',
}

interface State {
  theme: EDITOR_THEME;
}

const defaultState: State = {
  theme: EDITOR_THEME.LIGHT,
};

@Injectable({
  providedIn: 'root',
})
export class EditorState {
  private readonly storageService: LocalStorage = inject(LocalStorage);
  private readonly _state: WritableSignal<State> = signal(defaultState);
  public readonly state: Signal<State> = this._state.asReadonly();

  constructor() {
    this._state.set(this.storageService.getItems('editor') ?? defaultState);
    effect((): void => this.storageService.setItems('editor', this._state()));
  }

  public setTheme(theme: EDITOR_THEME): void {
    this._state.update((s: State): State => ({ ...s, theme: theme }));
  }
}
