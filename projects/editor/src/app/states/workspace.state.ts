import { Injectable, signal, WritableSignal } from '@angular/core';

interface State {
  isDirty: boolean;
}

const defaultState: State = {
  isDirty: false,
};

@Injectable({
  providedIn: 'root',
})
export class WorkspaceState {
  public readonly state: WritableSignal<State> = signal(defaultState);

  public isDirty(isDirty: boolean): void {
    this.state.update((s: State): State => ({ ...s, isDirty }));
  }
}
