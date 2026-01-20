import { effect, inject, Injectable, signal, WritableSignal } from '@angular/core';
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
  public readonly state: WritableSignal<State> = signal({ ...defaultState });

  constructor() {
    effect((): void => this.titleService.setTitle(this.state().title));
  }

  public setTitle(title: string, icon: string): void {
    this.state.update((s: State): State => ({ ...s, title, icon }));
  }
}
