import { effect, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { LocalStorageService } from '../services/local-storage.service';

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
  private static readonly STORAGE_KEY = 'editor';

  private readonly storageService: LocalStorageService = inject(LocalStorageService);
  public readonly state: WritableSignal<State> = signal({ ...defaultState });

  constructor() {
    this.state.set(this.storageService.get('editor') ?? defaultState);
    effect((): void => this.storageService.set(EditorState.STORAGE_KEY, this.state()));
  }

  public setTheme(theme: EDITOR_THEME): void {
    this.state.update((s: State): State => ({ ...s, theme: theme }));
  }
}
