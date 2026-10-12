import { computed, effect, inject, Injectable, signal, untracked, type Signal, type WritableSignal } from '@angular/core';
import { Modeller, type Id, type Model } from '@ramen-suite/core/model';
import { RamenModel, RamenModelFormat, type RamenFile } from '@ramen-suite/core/ramen';
import { getDefaultNodeColours } from '../../core/utils/NodeColours';
import { type ModelRecord, type NodeColors } from '../../models/ModelRecord';
import { StorageService } from '../storage.service';

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
      this.restoreWorkspace(projectId ? records.map((record: ModelRecord): Model => record.gmodel) : []);
    });
    effect((): void => {
      this.currentModel();
      this.currentNodeColors.set({
        ...getDefaultNodeColours(this.getModels()),
        ...this.currentModelRecord()?.view?.nodeColors,
      });
    });
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

  /** Exports every project level and rejects an exchange that would omit a branch. */
  public exportModel(): RamenFile {
    const workspace: RamenModel = this.getWorkspace();
    const level: RamenModel | undefined = [...this.levels.values()].at(-1);
    if (!level) throw new Error('No editable model is available for export.');

    const file: RamenFile = workspace.openLevel(level.getModel().id).export();
    const exportedIds: ReadonlySet<string> = new Set(file.models.map((model): string => model.id));
    if (this.getModels().some((model: Model): boolean => !exportedIds.has(model.id))) {
      throw new Error('RAMEN Core cannot export all branches in one file yet. No partial model was exported.');
    }
    return file;
  }

  public getModels(): readonly Model[] {
    return [
      ...this.referenceModels.map((model: Model): Model => structuredClone(model)),
      ...[...this.levels.values()].map((level: RamenModel): Model => level.getModel()),
    ];
  }

  public addLevel(level: RamenModel): void {
    this.levels.set(level.getModel().id, level);
    if (!this.workspace()) this.workspace.set(level);
  }

  public removeLevels(ids: readonly string[]): void {
    for (const id of ids) this.levels.delete(id);
    this.restoreWorkspace(this.getModels());
  }

  public getCreationParent(): RamenModel | null {
    return RamenModelFormat.isDocument(this.currentModel()) ? this.getDraft() : this.workspace();
  }

  public getParentLevel(id: string): RamenModel | Modeller {
    const model: Model | undefined = this.levels.get(id)?.getModel();
    if (!model) throw new Error('The selected editable model no longer exists.');

    const parentId: string | undefined = model.imports[0]?.modelId;
    const parent: RamenModel | undefined = this.levels.get(parentId ?? '');
    if (parent) return parent;

    const reference: Model | undefined = this.referenceModels.find((item: Model): boolean => item.id === parentId);
    if (!reference) throw new Error('The parent model could not be found.');
    return Modeller.load(
      reference,
      this.getModels().filter((item: Model): boolean => item.id !== reference.id),
    );
  }

  public restoreModels(models: readonly Model[]): void {
    this.restoreWorkspace(structuredClone(models));
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

  private restoreWorkspace(models: readonly Model[]): void {
    this.levels.clear();
    this.referenceModels = models.filter((model: Model): boolean => !RamenModelFormat.isDocument(model));
    const current: Model | undefined = [...models].reverse().find(RamenModelFormat.isDocument);
    const workspace: RamenModel | null = current
      ? RamenModel.load(
          current,
          models.filter((model: Model): boolean => model.id !== current.id),
        )
      : null;
    this.workspace.set(workspace);

    if (workspace) {
      for (const model of models) {
        if (RamenModelFormat.isDocument(model)) this.levels.set(model.id, workspace.openLevel(model.id));
      }
    }
    this.notifyChange();
  }
}
