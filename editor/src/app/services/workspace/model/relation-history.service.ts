import { computed, effect, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { type Model } from '@ramen-suite/core/model';
import { ProjectService } from '../../projects/project.service';
import { WorkspaceStore } from '../../../states/workspace.store';

interface RelationEdit {
  readonly modelId: string;
  readonly before: readonly Model[];
  readonly after: readonly Model[];
  readonly beforeSignature: string;
  readonly afterSignature: string;
}

/** Records relationship edits and restores model snapshots for undo and redo. */
@Injectable({ providedIn: 'root' })
export class RelationHistoryService {
  private readonly store: WorkspaceStore = inject(WorkspaceStore);
  private readonly projects: ProjectService = inject(ProjectService);

  private readonly past: WritableSignal<readonly RelationEdit[]> = signal([]);
  private readonly future: WritableSignal<readonly RelationEdit[]> = signal([]);
  private readonly restoring: WritableSignal<boolean> = signal(false);

  private readonly signature: Signal<string> = computed((): string => {
    this.store.currentModel();
    return JSON.stringify(this.store.getModels());
  });
  public readonly canUndo: Signal<boolean> = computed((): boolean => {
    const edit: RelationEdit | undefined = this.past().at(-1);
    return this.isAvailable(edit) && edit.afterSignature === this.signature();
  });
  public readonly canRedo: Signal<boolean> = computed((): boolean => {
    const edit: RelationEdit | undefined = this.future().at(-1);
    return this.isAvailable(edit) && edit.beforeSignature === this.signature();
  });

  public constructor() {
    effect((): void => {
      this.projects.loadedProjectId();
      this.past.set([]);
      this.future.set([]);
    });
  }

  public capture(): readonly Model[] {
    return structuredClone(this.store.getModels());
  }

  public record(modelId: string, before: readonly Model[]): void {
    const after: readonly Model[] = this.capture();
    const beforeSignature: string = JSON.stringify(before);
    const afterSignature: string = JSON.stringify(after);
    if (beforeSignature === afterSignature) return;

    const previous: RelationEdit | undefined = this.past().at(-1);
    const retained: readonly RelationEdit[] = previous?.afterSignature === beforeSignature ? this.past() : [];
    this.past.set([...retained, { modelId, before, after, beforeSignature, afterSignature }].slice(-50));
    this.future.set([]);
  }

  public async undo(save: () => Promise<void>): Promise<void> {
    if (!this.canUndo()) return;
    await this.restore(this.past, this.future, 'before', save);
  }

  public async redo(save: () => Promise<void>): Promise<void> {
    if (!this.canRedo()) return;
    await this.restore(this.future, this.past, 'after', save);
  }

  private isAvailable(edit: RelationEdit | undefined): edit is RelationEdit {
    return !!edit && !this.restoring() && edit.modelId === this.store.currentModel()?.id;
  }

  private async restore(
    source: WritableSignal<readonly RelationEdit[]>,
    target: WritableSignal<readonly RelationEdit[]>,
    state: 'before' | 'after',
    save: () => Promise<void>,
  ): Promise<void> {
    const edit: RelationEdit | undefined = source().at(-1);
    if (!edit) return;
    const previous: readonly Model[] = this.capture();
    const projectId: string | null = this.projects.loadedProjectId();

    this.restoring.set(true);
    try {
      this.store.restoreModels(edit[state]);
      await save();
      if (this.projects.loadedProjectId() !== projectId) return;

      source.update((edits: readonly RelationEdit[]): readonly RelationEdit[] => edits.filter((item): boolean => item !== edit));
      target.update((edits: readonly RelationEdit[]): readonly RelationEdit[] => [...edits, edit]);
    } catch (error: unknown) {
      if (
        this.projects.loadedProjectId() === projectId &&
        JSON.stringify(this.store.getModels()) === JSON.stringify(edit[state])
      ) {
        this.store.restoreModels(previous);
      }
      throw error;
    } finally {
      this.restoring.set(false);
    }
  }
}
