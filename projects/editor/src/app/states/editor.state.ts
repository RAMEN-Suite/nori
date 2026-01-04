import { effect, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { StorageService } from '../services/storage.service';

export enum EDITOR_THEME {
  LIGHT = 'light',
  DARK = 'dark',
}

interface IEditorState {
  theme: EDITOR_THEME;
}

const defaultState: IEditorState = {
  theme: EDITOR_THEME.LIGHT,
};

@Injectable({
  providedIn: 'root',
})
export class EditorState {
  private readonly storageService: StorageService = inject(StorageService);
  private readonly _state: WritableSignal<IEditorState> = signal(defaultState);

  public readonly state: Signal<IEditorState> = this._state.asReadonly();

  constructor() {
    this._state.set(this.storageService.getItems('editor') ?? defaultState);
    effect((): void => this.storageService.setItems('editor', this._state()));
  }

  public setTheme(theme: EDITOR_THEME): void {
    this._state.update((s: IEditorState): IEditorState => ({ ...s, theme: theme }));
  }
}
