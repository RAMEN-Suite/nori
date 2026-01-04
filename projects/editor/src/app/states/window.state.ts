import { effect, inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { Title } from '@angular/platform-browser';

interface IWindowState {
  title: string;
  icon: string;
}

const defaultState: IWindowState = {
  title: '',
  icon: '',
};

@Injectable({
  providedIn: 'root',
})
export class WindowState {
  private readonly titleService: Title = inject(Title);
  private readonly _state: WritableSignal<IWindowState> = signal(defaultState);

  public readonly state: Signal<IWindowState> = this._state.asReadonly();

  constructor() {
    effect((): void => this.titleService.setTitle(this._state().title));
  }

  public setTitle(title: string, icon: string): void {
    this._state.update((s: IWindowState): IWindowState => ({ ...s, title, icon }));
  }
}
