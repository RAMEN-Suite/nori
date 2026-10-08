import { effect, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { Title } from '@angular/platform-browser';

interface State {
  title: string;
}

const defaultState: State = {
  title: '',
};

@Injectable({
  providedIn: 'root',
})
export class WindowState {
  private readonly titleService: Title = inject(Title);
  public readonly state: WritableSignal<State> = signal({ ...defaultState });

  public constructor() {
    effect((): void => this.titleService.setTitle(this.state().title));
  }

  public setTitle(title: string): void {
    this.state.update((s: State): State => ({ ...s, title }));
  }
}
