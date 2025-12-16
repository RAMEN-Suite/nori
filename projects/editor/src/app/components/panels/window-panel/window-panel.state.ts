import { effect, inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { Title } from '@angular/platform-browser';

export interface IWindowPanelState {
  title: string;
  icon: string;
}

@Injectable({
  providedIn: 'root',
})
export class WindowPanelState {
  private readonly title: Title = inject(Title);
  private readonly _state: WritableSignal<IWindowPanelState> = signal({ title: '', icon: '' });

  public readonly state: Signal<IWindowPanelState> = this._state.asReadonly();

  constructor() {
    effect((): void => this.title.setTitle(this._state().title));
  }

  public setState(state: IWindowPanelState): void {
    this._state.set(state);
  }
}
