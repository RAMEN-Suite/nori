import { computed, effect, inject, Injectable, Signal, signal, untracked, WritableSignal } from '@angular/core';
import { type Model, type Id } from '@ramen-suite/core/model';
import { RamenModel, RamenModelFormat } from '@ramen-suite/core/ramen';
import { StorageService } from '../storage.service';
import { type ModelRecord, type NodeColors } from '../../models/ModelRecord';

@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  private readonly storage: StorageService = inject(StorageService);
  private readonly workspace: WritableSignal<RamenModel | null> = signal(null);
  private readonly levels: Map<string, RamenModel> = new Map();
  private referenceModels: readonly Model[] = [];
  private readonly change: WritableSignal<number> = signal(0);

  public readonly currentSlot: WritableSignal<number> = signal(1);
  public readonly currentNodeId: WritableSignal<Id | null> = signal(null);
  public readonly currentNodeColors: WritableSignal<NodeColors> = signal({});
  public readonly currentModelRecord: Signal<ModelRecord | null> = computed(
    (): ModelRecord | null => this.storage.recordsBySlot().get(this.currentSlot()) ?? null,
  );
  public readonly currentModel: Signal<Model | null> = computed((): Model | null => {
    this.change();
    const record: ModelRecord | null = this.currentModelRecord();
    if (!record) return null;
    return (
      this.levels.get(record.gmodel.id)?.getModel() ??
      this.referenceModels.find((model: Model): boolean => model.id === record.gmodel.id) ??
      null
    );
  });

  public constructor() {
    effect((): void => {
      const projectId: string | null = this.storage.loadedProjectId();
      const records: ModelRecord[] = untracked((): ModelRecord[] => this.storage.records());
      const current: ModelRecord | undefined = [...records]
        .reverse()
        .find((record: ModelRecord): boolean => RamenModelFormat.isDocument(record.gmodel));
      this.levels.clear();
      this.referenceModels = records
        .filter((record: ModelRecord): boolean => !RamenModelFormat.isDocument(record.gmodel))
        .map((record: ModelRecord): Model => record.gmodel);
      const workspace: RamenModel | null =
        projectId && current
          ? RamenModel.load(
              current.gmodel,
              records
                .filter((record: ModelRecord): boolean => record.gmodel.id !== current.gmodel.id)
                .map((record: ModelRecord): Model => record.gmodel),
            )
          : null;
      this.workspace.set(workspace);
      if (workspace) {
        for (const record of records) {
          if (RamenModelFormat.isDocument(record.gmodel))
            this.levels.set(record.gmodel.id, workspace.openLevel(record.gmodel.id));
        }
      }
      this.notifyChange();
    });
    effect((): void => this.currentNodeColors.set(this.currentModelRecord()?.view?.nodeColors ?? {}));
  }

  public getDraft(): RamenModel {
    const workspace: RamenModel | null = this.workspace();
    const model: Model | null = this.currentModel();
    if (!workspace || !model) throw new Error('No model is selected.');
    return workspace.openLevel(model.id);
  }

  public getWorkspace(): RamenModel {
    const workspace: RamenModel | null = this.workspace();
    if (!workspace) throw new Error('No project is loaded.');
    return workspace;
  }

  public getModels(): readonly Model[] {
    return [
      ...this.referenceModels.map((model: Model): Model => structuredClone(model)),
      ...[...this.levels.values()].map((level: RamenModel): Model => level.getModel()),
    ];
  }

  public addLevel(level: RamenModel): void {
    this.levels.set(level.getModel().id, level);
  }

  public removeLevels(ids: readonly string[]): void {
    for (const id of ids) this.levels.delete(id);
  }

  public getParentLevel(id: string): RamenModel {
    const model: Model | undefined = this.levels.get(id)?.getModel();
    const parent: RamenModel | undefined = this.levels.get(model?.imports[0]?.modelId ?? '');
    if (!parent) throw new Error('The initial project level is retained. Remove the project to delete it.');
    return parent;
  }

  public notifyChange(): void {
    this.change.update((value: number): number => value + 1);
  }

  public setCurrentSlot(slot: number | null): void {
    this.currentSlot.set(slot === null ? 1 : Math.max(0, slot));
  }

  public setCurrentNodeId(nodeId: Id | null): void {
    this.currentNodeId.set(nodeId);
  }

  public setCurrentNodeColors(colors: NodeColors): void {
    this.currentNodeColors.set(colors);
  }

  public updateCurrentNodeColors(nodeId: Id, colour: string): void {
    this.currentNodeColors.update((colours: NodeColors): NodeColors => ({ ...colours, [nodeId]: colour }));
  }
}
