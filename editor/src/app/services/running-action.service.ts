import { inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type ModelRecord } from '../models/ModelRecord';
import { StorageService } from './storage.service';

export interface RunningActionOptions {
  readonly kind: 'deletion';
  readonly projectId: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly resume: (signal: AbortSignal) => Promise<void>;
}

interface RunningAction extends RunningActionOptions {
  readonly revision: string;
  readonly controller: AbortController;
}

@Injectable({ providedIn: 'root' })
export class RunningActionService {
  private readonly storage: StorageService = inject(StorageService);
  private readonly active: WritableSignal<RunningAction | null> = signal(null);
  public readonly current: Signal<RunningAction | null> = this.active.asReadonly();
  public readonly pending: WritableSignal<boolean> = signal(false);

  public constructor() {
    this.storage.modelChanges$.pipe(takeUntilDestroyed()).subscribe((projectId: string): void => {
      if (this.active()?.projectId === projectId) this.discard();
    });
  }

  public async start(options: RunningActionOptions): Promise<void> {
    const revision: string = await this.projectRevision(options.projectId);
    this.discard();
    this.active.set({ ...options, revision, controller: new AbortController() });
  }

  public async resume(): Promise<void> {
    const action: RunningAction | null = this.active();
    if (!action || this.pending()) return;
    this.pending.set(true);
    try {
      const revision: string = await this.projectRevision(action.projectId);
      if (this.active() !== action) return;
      if (revision !== action.revision) {
        this.discard();
        return;
      }
      await action.resume(action.controller.signal);
      if (this.active() === action) this.discard();
    } catch (error: unknown) {
      this.storage.reportError(error);
    } finally {
      this.pending.set(false);
    }
  }

  public cancel(): void {
    if (!this.pending()) this.discard();
  }

  private discard(): void {
    this.active()?.controller.abort();
    this.active.set(null);
  }

  private async projectRevision(projectId: string): Promise<string> {
    const records: readonly ModelRecord[] = await this.storage.getProjectRecords(projectId);
    return JSON.stringify(records.map((record: ModelRecord): readonly [string, number] => [record.modelId, record.revision]));
  }
}
