import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  linkedSignal,
  untracked,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { Modeller, type Id, type Model } from '@ramen-suite/core/model';
import { RamenModel, RamenModelFormat, type RamenFile } from '@ramen-suite/core/ramen';
import { getDefaultNodeColours } from '../utils/node-colours';
import { type ModelRecord, type NodeColours } from '../models/ModelRecord';
import { type Manifest } from '../models/Manifest';
import { ProjectService } from '../services/projects/project.service';

/** Owns the loaded Core workspace, selected elements and model change notifications. */
@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  private readonly projects: ProjectService = inject(ProjectService);

  private readonly workspace: WritableSignal<RamenModel | null> = signal(null);
  private readonly levels: Map<string, RamenModel> = new Map();
  private referenceModels: readonly Model[] = [];
  private readonly modelSnapshots: WritableSignal<readonly Model[]> = signal([]);
  public readonly models: Signal<readonly Model[]> = this.modelSnapshots.asReadonly();
  public readonly currentLevelIndex: WritableSignal<number> = signal(1);
  public readonly currentRelationId: WritableSignal<Id | null> = signal(null);
  public readonly currentNodeId: WritableSignal<Id | null> = signal(null);
  public readonly currentModelRecord: Signal<ModelRecord | null> = computed(
    (): ModelRecord | null => this.projects.recordsByLevelIndex().get(this.currentLevelIndex()) ?? null,
  );
  public readonly currentModel: Signal<Model | null> = computed((): Model | null => {
    const modelId: string | undefined = this.currentModelRecord()?.gmodel.id;
    return this.models().find((model: Model): boolean => model.id === modelId) ?? null;
  });

  public readonly currentNodeColours: WritableSignal<NodeColours> = linkedSignal({
    source: this.currentModelRecord,
    computation: (record: ModelRecord | null): NodeColours => ({
      ...getDefaultNodeColours(this.models()),
      ...record?.view?.nodeColors,
    }),
    equal: (previous: NodeColours, current: NodeColours): boolean =>
      Object.keys(previous).length === Object.keys(current).length &&
      Object.entries(previous).every(([key, colour]): boolean => current[key] === colour),
  });

  public constructor() {
    effect((): void => {
      const projectId: string | null = this.projects.loadedProjectId();
      const records: ModelRecord[] = untracked((): ModelRecord[] => this.projects.records());
      this.restoreWorkspace(projectId ? records.map((record: ModelRecord): Model => record.gmodel) : []);
    });
  }

  public getDraft(modelId: string | undefined = this.currentModel()?.id): RamenModel {
    const workspace: RamenModel | null = this.workspace();
    if (!workspace || !modelId) throw new Error('No model is selected.');
    return this.levels.get(modelId) ?? workspace.openLevel(modelId);
  }

  public getWorkspace(): RamenModel {
    const workspace: RamenModel | null = this.workspace();
    if (!workspace) throw new Error('No project is loaded.');
    return workspace;
  }

  public exportModel(): RamenFile {
    const workspace: RamenModel = this.getWorkspace();
    const level: RamenModel | undefined = [...this.levels.values()].at(-1);
    if (!level) throw new Error('No editable model is available for export.');

    const project: Manifest | null = this.projects.selectedManifest();
    if (!project) throw new Error('No project is loaded.');

    const file: RamenFile = workspace.openLevel(level.getModel().id).export({
      name: project.name,
      description: project.description,
    });
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
    this.modelSnapshots.set(this.getModels());
  }

  public selectLevel(levelIndex: number | null): void {
    this.currentLevelIndex.set(levelIndex === null ? 1 : Math.max(0, levelIndex));
  }

  public setCurrentNodeId(nodeId: Id | null): void {
    this.currentRelationId.set(null);
    this.currentNodeId.set(nodeId);
  }

  public setCurrentRelationId(relationId: Id | null): void {
    this.currentNodeId.set(null);
    this.currentRelationId.set(relationId);
  }

  public setCurrentNodeColours(colours: NodeColours): void {
    this.currentNodeColours.set(colours);
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
