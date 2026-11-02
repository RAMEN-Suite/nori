import { inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { InteractionBlockedError } from '../../models/InteractionBlockedError';
import { type BlockingActionOwner } from '../../models/Feedback';

export interface InteractionHandle {
  readonly id: string;
  readonly signal: AbortSignal;
}

export interface ActiveInteraction extends InteractionHandle {
  readonly phase: 'decision' | 'executing';
  readonly owner: BlockingActionOwner | 'workspace-edit';
  readonly projectId: string;
  readonly revision?: string;
}

export type InteractionState = { readonly phase: 'ready' } | ActiveInteraction;
export interface InteractionAttention {
  readonly interactionId: string;
  readonly sequence: number;
}

/** Authoritative command gate. Presentation reacts to this state; it never grants editing permission. */
@Injectable({ providedIn: 'root' })
export class InteractionStateService {
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly state: WritableSignal<InteractionState> = signal({ phase: 'ready' });
  private readonly attentionState: WritableSignal<InteractionAttention | null> = signal(null);
  private controller: AbortController | null = null;
  private sequence: number = 0;
  public readonly current: Signal<InteractionState> = this.state.asReadonly();
  public readonly attention: Signal<InteractionAttention | null> = this.attentionState.asReadonly();

  public beginDecision(owner: BlockingActionOwner, projectId: string, revision: string): InteractionHandle {
    this.assertCanMutate();
    return this.begin({ phase: 'decision', owner, projectId, revision });
  }

  public assertCanMutate(): void {
    const state: InteractionState = this.current();
    if (state.phase === 'ready') return;
    this.attentionState.update(
      (attention): InteractionAttention => ({
        interactionId: state.id,
        sequence: (attention?.sequence ?? 0) + 1,
      }),
    );
    throw new InteractionBlockedError(
      this.translations.translate(state.phase === 'decision' ? 'editor.resolvePendingAction' : 'editor.operationInProgress'),
      state.owner !== 'workspace-edit',
    );
  }

  public async mutate<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    this.assertCanMutate();
    const handle: InteractionHandle = this.begin({ phase: 'executing', owner: 'workspace-edit', projectId });
    try {
      return await operation();
    } finally {
      this.end(handle);
    }
  }

  public async executeDecision(handle: InteractionHandle, operation: () => Promise<void>): Promise<boolean> {
    const state: InteractionState = this.current();
    if (state.phase !== 'decision' || !this.owns(handle)) return false;
    this.attentionState.set(null);
    this.state.set({ ...state, phase: 'executing' });
    try {
      await operation();
      if (!this.owns(handle)) return false;
      this.end(handle);
      return true;
    } catch (error: unknown) {
      if (this.owns(handle)) this.state.set(state);
      throw error;
    }
  }

  public end(handle: InteractionHandle): void {
    const state: InteractionState = this.current();
    if (state.phase === 'ready' || state.id !== handle.id) return;
    this.controller?.abort();
    this.controller = null;
    this.attentionState.set(null);
    this.state.set({ phase: 'ready' });
  }

  private begin(options: Omit<ActiveInteraction, keyof InteractionHandle>): InteractionHandle {
    this.controller = new AbortController();
    const handle: InteractionHandle = { id: `interaction-${++this.sequence}`, signal: this.controller.signal };
    this.attentionState.set(null);
    this.state.set({ ...options, ...handle });
    return handle;
  }

  private owns(handle: InteractionHandle): boolean {
    const state: InteractionState = this.current();
    return state.phase !== 'ready' && state.id === handle.id && !handle.signal.aborted;
  }
}
