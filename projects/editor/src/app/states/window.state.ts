import { effect, inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { Title } from '@angular/platform-browser';

interface State {
  title: string;
  icon: string;
}

const defaultState: State = {
  title: '',
  icon: '',
};

@Injectable({
  providedIn: 'root',
})
export class WindowState {
  private readonly titleService: Title = inject(Title);
  private readonly _state: WritableSignal<State> = signal(defaultState);
  public readonly state: Signal<State> = this._state.asReadonly();

  constructor() {
    effect((): void => this.titleService.setTitle(this._state().title));
  }

  public setTitle(title: string, icon: string): void {
    this._state.update((s: State): State => ({ ...s, title, icon }));
  }
}
