import { computed, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModelRef, type Model } from '@ramen-suite/core/model';
import { RamenModelFormat, type AnnotationShape } from '@ramen-suite/core/ramen';
import { type ModelRecord, type ViewSettings } from '../../../models/ModelRecord';
import { WorkspaceStore } from '../../../states/workspace.store';
import { NavigationService } from '../../interaction/navigation.service';
import { ProjectService } from '../../projects/project.service';

export interface HistorySnapshot {
  readonly projectId: string;
  readonly session: number;
  readonly models: readonly Model[];
  readonly views: ReadonlyMap<string, ViewSettings>;
  readonly signature: string;
  readonly modelId: string | null;
  readonly nodeId: string | null;
  readonly relationId: string | null;
}
interface ModelEdit {
  readonly before: HistorySnapshot;
  readonly after: HistorySnapshot;
}
type SaveHistory = (views: ReadonlyMap<string, ViewSettings>) => Promise<void>;

/** Session-local model history. One successful command, including cascaded removals, is one step. */
@Injectable({ providedIn: 'root' })
export class ModelHistoryService {
  private readonly store: WorkspaceStore = inject(WorkspaceStore);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly past: WritableSignal<readonly ModelEdit[]> = signal([]);
  private readonly future: WritableSignal<readonly ModelEdit[]> = signal([]);
  private readonly restoring: WritableSignal<boolean> = signal(false);
  private session: number = 0;
  private readonly signature: Signal<string> = computed((): string => {
    this.store.currentModel();
    return JSON.stringify(this.store.getModels());
  });
  public readonly canUndo: Signal<boolean> = computed((): boolean => {
    const edit: ModelEdit | undefined = this.past().at(-1);
    return !!edit && this.isCurrent(edit.after) && !this.restoring() && edit.after.signature === this.signature();
  });
  public readonly canRedo: Signal<boolean> = computed((): boolean => {
    const edit: ModelEdit | undefined = this.future().at(-1);
    return !!edit && this.isCurrent(edit.before) && !this.restoring() && edit.before.signature === this.signature();
  });

  public readonly canUndoCurrentNode: Signal<boolean> = computed(
    (): boolean => this.canUndo() && this.affectsCurrentNode(this.past().at(-1)),
  );
  public readonly canRedoCurrentNode: Signal<boolean> = computed(
    (): boolean => this.canRedo() && this.affectsCurrentNode(this.future().at(-1)),
  );

  private affectsCurrentNode(edit: ModelEdit | undefined): boolean {
    const modelId: string | undefined = this.store.currentModel()?.id;
    const nodeId: string | null = this.store.currentNodeId();
    if (!edit || !modelId || !nodeId) return false;
    const ownerId: string = ModelRef.isQualified(nodeId) ? ModelRef.splitQualified(nodeId).modelId : modelId;
    const id: string = ModelRef.localId(nodeId);
    const before: Model | undefined = edit.before.models.find((model): boolean => model.id === ownerId);
    const after: Model | undefined = edit.after.models.find((model): boolean => model.id === ownerId);
    if (!before || !after) return false;
    const beforeNode: Model['classifiers'][number] | undefined = before.classifiers.find(
      (item): boolean => item.kind === 'Node' && item.id === id,
    );
    const afterNode: Model['classifiers'][number] | undefined = after.classifiers.find(
      (item): boolean => item.kind === 'Node' && item.id === id,
    );
    if (!beforeNode || !afterNode) return false;
    const shapes: (model: Model) => readonly AnnotationShape[] = (model: Model): readonly AnnotationShape[] =>
      RamenModelFormat.isDocument(model)
        ? model.annotations.filter((shape: AnnotationShape): boolean => shape.annotationId === id)
        : [];
    return JSON.stringify([beforeNode, shapes(before)]) !== JSON.stringify([afterNode, shapes(after)]);
  }

  public constructor() {
    this.projects.projectSelectionChanges$.pipe(takeUntilDestroyed()).subscribe((): void => {
      this.session++;
      this.past.set([]);
      this.future.set([]);
    });
  }

  public capture(): HistorySnapshot {
    const projectId: string | null = this.projects.loadedProjectId();
    if (!projectId || projectId !== this.projects.selectedProjectId()) throw new Error('No project is loaded.');
    const models: readonly Model[] = structuredClone(this.store.getModels());
    const views: Map<string, ViewSettings> = new Map();
    for (const record of this.projects.records()) {
      if (record.view) views.set(record.gmodel.id, structuredClone(record.view));
    }
    return {
      projectId,
      session: this.session,
      models,
      views,
      signature: JSON.stringify(models),
      modelId: this.store.currentModel()?.id ?? null,
      nodeId: this.store.currentNodeId(),
      relationId: this.store.currentRelationId(),
    };
  }

  public isCurrent(snapshot: HistorySnapshot): boolean {
    return (
      snapshot.session === this.session &&
      snapshot.projectId === this.projects.loadedProjectId() &&
      snapshot.projectId === this.projects.selectedProjectId()
    );
  }

  public record(before: HistorySnapshot): void {
    if (!this.isCurrent(before)) return;
    const after: HistorySnapshot = this.capture();
    if (before.signature === after.signature) return;
    const previous: ModelEdit | undefined = this.past().at(-1);
    const retained: readonly ModelEdit[] = previous?.after.signature === before.signature ? this.past() : [];
    this.past.set([...retained, { before, after }].slice(-50));
    this.future.set([]);
  }

  public rollback(snapshot: HistorySnapshot): void {
    if (this.isCurrent(snapshot)) this.store.restoreModels(snapshot.models);
  }

  public async undo(save: SaveHistory, currentNodeOnly: boolean = false): Promise<void> {
    if (currentNodeOnly ? this.canUndoCurrentNode() : this.canUndo())
      await this.restore(this.past, this.future, 'before', save, currentNodeOnly);
  }
  public async redo(save: SaveHistory, currentNodeOnly: boolean = false): Promise<void> {
    if (currentNodeOnly ? this.canRedoCurrentNode() : this.canRedo())
      await this.restore(this.future, this.past, 'after', save, currentNodeOnly);
  }

  private async restore(
    source: WritableSignal<readonly ModelEdit[]>,
    target: WritableSignal<readonly ModelEdit[]>,
    direction: 'before' | 'after',
    save: SaveHistory,
    currentNodeOnly: boolean,
  ): Promise<void> {
    const edit: ModelEdit | undefined = source().at(-1);
    if (!edit) return;
    const previous: HistorySnapshot = this.capture();
    const next: HistorySnapshot = edit[direction];
    this.restoring.set(true);
    try {
      this.store.restoreModels(next.models);
      await save(next.views);
    } catch (error: unknown) {
      this.rollback(previous);
      throw error;
    } finally {
      this.restoring.set(false);
    }
    if (!this.isCurrent(previous)) return;
    source.set(source().filter((item): boolean => item !== edit));
    target.set([...target(), edit]);
    if (!currentNodeOnly || !previous.modelId || !previous.nodeId || !this.hasNode(next, previous.modelId, previous.nodeId)) {
      await this.restoreSelection(next);
    }
  }

  private async restoreSelection(snapshot: HistorySnapshot): Promise<void> {
    const record: ModelRecord | undefined =
      this.projects.recordsByModelId().get(snapshot.modelId ?? '') ??
      this.projects.records().find((item): boolean => RamenModelFormat.isDocument(item.gmodel));
    if (!record || !this.isCurrent(snapshot)) return;
    const model: Model = record.gmodel;
    const relationId: string | undefined = model.relations.find((item): boolean => item.id === snapshot.relationId)?.id;
    const nodeId: string | undefined =
      snapshot.nodeId && this.hasNode(snapshot, model.id, snapshot.nodeId) ? snapshot.nodeId : undefined;
    try {
      await this.navigation.navigateToLocation({
        projectId: snapshot.projectId,
        levelIndex: record.levelIndex,
        nodeId,
        relationId,
      });
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  private hasNode(snapshot: HistorySnapshot, modelId: string, ref: string): boolean {
    const ownerId: string = ModelRef.isQualified(ref) ? ModelRef.splitQualified(ref).modelId : modelId;
    const id: string = ModelRef.localId(ref);
    return (
      snapshot.models
        .find((model): boolean => model.id === ownerId)
        ?.classifiers.some((item): boolean => item.kind === 'Node' && item.id === id) ?? false
    );
  }
}
