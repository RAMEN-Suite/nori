import { effect, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { StorageService } from '../../../services/storage.service';

export enum EDITOR_THEME {
  LIGHT = 'light',
  DARK = 'dark',
}

interface IEditorPanelState {
  theme: EDITOR_THEME;
}

const defaultState: IEditorPanelState = {
  theme: EDITOR_THEME.LIGHT,
};

@Injectable({
  providedIn: 'root',
})
export class EditorPanelState {
  private readonly storageService: StorageService = inject(StorageService);
  private readonly _state: WritableSignal<IEditorPanelState> = signal(defaultState);

  public readonly state: Signal<IEditorPanelState> = this._state.asReadonly();

  constructor() {
    effect((): void => this.storageService.setItems('editor', this._state().theme));
  }

  public setTheme(theme: EDITOR_THEME): void {
    this._state.update((s: IEditorPanelState): IEditorPanelState => ({ ...s, theme: theme }));
  }
}
