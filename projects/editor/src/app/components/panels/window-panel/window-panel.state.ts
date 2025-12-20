import { effect, inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { Title } from '@angular/platform-browser';

interface IWindowPanelState {
  title: string;
  icon: string;
}

const defaultState: IWindowPanelState = {
  title: '',
  icon: '',
};

@Injectable({
  providedIn: 'root',
})
export class WindowPanelState {
  private readonly titleService: Title = inject(Title);
  private readonly _state: WritableSignal<IWindowPanelState> = signal(defaultState);

  public readonly state: Signal<IWindowPanelState> = this._state.asReadonly();

  constructor() {
    effect((): void => this.titleService.setTitle(this._state().title));
  }

  public setTitle(title: string, icon: string): void {
    this._state.update((s: IWindowPanelState): IWindowPanelState => ({ ...s, title, icon }));
  }
}
