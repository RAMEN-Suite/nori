import { computed, effect, Injectable, type Signal, signal, type WritableSignal } from '@angular/core';
import { type Model } from '@ramen-suite/core/model';
import { RamenModel, RAMEN_MODEL } from '@ramen-suite/core/ramen';
import ShortUniqueId from 'short-unique-id';
import { type Manifest } from '../models/Manifest';
import { type ModelRecord, type ViewSettings } from '../models/ModelRecord';
import { database } from '../app.database';
import { environment } from '../../environments/environment';

export type CreateManifest = Pick<Manifest, 'name' | 'description' | 'metamodelName' | 'metamodelId' | 'metamodelVersion'>;
export type UpdateManifest = Pick<Manifest, 'name' | 'description'>;
export type UpdateRecordInput = Partial<Pick<ModelRecord, 'gmodel' | 'name' | 'view'>>;

@Injectable({ providedIn: 'root' })
export class StorageService {
  public readonly manifests: WritableSignal<Manifest[]> = signal([]);
  public readonly records: WritableSignal<ModelRecord[]> = signal([]);
  public readonly selectedProjectId: WritableSignal<string | null> = signal(null);
  public readonly loadedProjectId: WritableSignal<string | null> = signal(null);
  public readonly selectedManifest: WritableSignal<Manifest | null> = signal(null);
  public readonly error: WritableSignal<string | null> = signal(null);
  public readonly recordsBySlot: Signal<ReadonlyMap<number, ModelRecord>> = computed(
    (): ReadonlyMap<number, ModelRecord> =>
      new Map(this.records().map((record: ModelRecord): [number, ModelRecord] => [record.slot, record])),
  );
  public readonly modelsById: Signal<ReadonlyMap<string, Model>> = computed(
    (): ReadonlyMap<string, Model> =>
      new Map(this.records().map((record: ModelRecord): [string, Model] => [record.gmodel.id, record.gmodel])),
  );

  public constructor() {
    effect((): void => {
      const projectId: string | null = this.selectedProjectId();
      this.loadedProjectId.set(null);
      this.records.set([]);
      this.selectedManifest.set(null);
      if (projectId) void this.initProject(projectId).catch((error: unknown): void => this.reportError(error));
    });
  }

  public reportError(error: unknown): void {
    this.error.set(error instanceof Error ? error.message : 'The operation could not be completed.');
  }

  public async isProjectExisting(id: string): Promise<boolean> {
    return (await database.manifests.get(id)) !== undefined;
  }

  public selectProject(id: string | null): void {
    this.selectedProjectId.set(id);
  }

  public async refreshManifests(): Promise<void> {
    this.manifests.set(await database.manifests.orderBy('updatedAt').reverse().toArray());
  }

  public async createProject(input: CreateManifest, _metamodel: Model, example?: Model): Promise<Manifest> {
    const projectId: string = new ShortUniqueId({ length: 18 }).randomUUID();
    const timestamp: string = new Date().toISOString();
    const manifest: Manifest = {
      ...input,
      projectId,
      createdAt: timestamp,
      updatedAt: timestamp,
      manifestVersion: environment.manifestVersion,
      appVersion: environment.appVersion,
    };
    const draft: RamenModel = example ? RamenModel.load(example, [RAMEN_MODEL]) : RamenModel.create(input.name);
    const records: ModelRecord[] = draft
      .getModels()
      .map((model: Model, slot: number): ModelRecord => this.createRecord(projectId, model, slot));

    await database.transaction('rw', database.manifests, database.models, async (): Promise<void> => {
      await database.manifests.add(manifest);
      await database.models.bulkAdd(records);
    });
    await this.refreshManifests();
    return manifest;
  }

  public async initProject(id: string): Promise<void> {
    const [manifest, records]: [Manifest | undefined, ModelRecord[]] = await Promise.all([
      database.manifests.get(id),
      database.models.where('projectId').equals(id).toArray(),
    ]);
    if (this.selectedProjectId() !== id) return;
    if (!manifest) throw new Error('Project not found.');

    this.selectedManifest.set(manifest);
    this.records.set(records.sort((left: ModelRecord, right: ModelRecord): number => left.slot - right.slot));
    this.loadedProjectId.set(id);
  }

  public async updateProject(id: string, patch: UpdateManifest): Promise<void> {
    await database.manifests.update(id, { ...patch, updatedAt: new Date().toISOString() });
    await this.refreshManifests();
    if (id === this.selectedProjectId()) this.selectedManifest.set((await database.manifests.get(id)) ?? null);
  }

  public async duplicateProject(id: string): Promise<void> {
    const source: Manifest | undefined = await database.manifests.get(id);
    if (!source) throw new Error('Project not found.');
    const projectId: string = new ShortUniqueId({ length: 18 }).randomUUID();
    const timestamp: string = new Date().toISOString();
    const records: ModelRecord[] = await database.models.where('projectId').equals(id).toArray();
    const copies: ModelRecord[] = records.map(
      (record: ModelRecord): ModelRecord => ({
        ...structuredClone(record),
        projectId,
        modelId: new ShortUniqueId({ length: 18 }).randomUUID(),
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );

    await database.transaction('rw', database.manifests, database.models, async (): Promise<void> => {
      await database.manifests.add({
        ...source,
        projectId,
        name: `${source.name} (copy)`,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await database.models.bulkAdd(copies);
    });
    await this.refreshManifests();
  }

  public async removeProject(id: string): Promise<void> {
    await database.transaction('rw', database.manifests, database.models, async (): Promise<void> => {
      await database.models.where('projectId').equals(id).delete();
      await database.manifests.delete(id);
    });
    if (this.selectedProjectId() === id) this.selectProject(null);
    await this.refreshManifests();
  }

  public async updateRecord(id: string, patch: UpdateRecordInput): Promise<void> {
    const record: ModelRecord | undefined = await database.models.get(id);
    if (!record) throw new Error('Model record not found.');
    const updated: ModelRecord = {
      ...record,
      ...patch,
      updatedAt: new Date().toISOString(),
      revision: record.revision + (patch.gmodel ? 1 : 0),
    };
    await database.models.put(updated);
    if (this.selectedProjectId() === record.projectId)
      this.records.update((records: ModelRecord[]): ModelRecord[] =>
        records.map((item: ModelRecord): ModelRecord => (item.modelId === id ? updated : item)),
      );
  }

  public async updateView(id: string, patch: Partial<ViewSettings>): Promise<void> {
    const view: ViewSettings = await database.transaction('rw', database.models, async (): Promise<ViewSettings> => {
      const record: ModelRecord | undefined = await database.models.get(id);
      if (!record) throw new Error('Model record not found.');
      const updated: ViewSettings = { nodeColors: {}, ...record.view, ...patch };
      await database.models.update(id, { view: updated });
      return updated;
    });
    this.records.update((records: ModelRecord[]): ModelRecord[] =>
      records.map((record: ModelRecord): ModelRecord => (record.modelId === id ? { ...record, view } : record)),
    );
  }

  public async saveModels(projectId: string, models: readonly Model[]): Promise<void> {
    const previous: ModelRecord[] = await database.models.where('projectId').equals(projectId).toArray();
    const byId: Map<string, ModelRecord> = new Map(
      previous.map((record: ModelRecord): [string, ModelRecord] => [record.gmodel.id, record]),
    );
    const records: ModelRecord[] = models.map((model: Model, slot: number): ModelRecord => {
      const old: ModelRecord | undefined = byId.get(model.id);
      return old
        ? { ...old, slot, gmodel: model, name: model.name, revision: old.revision + 1, updatedAt: new Date().toISOString() }
        : this.createRecord(projectId, model, slot);
    });

    await database.transaction('rw', database.manifests, database.models, async (): Promise<void> => {
      await database.models.where('projectId').equals(projectId).delete();
      await database.models.bulkPut(records);
      await database.manifests.update(projectId, { updatedAt: new Date().toISOString() });
    });
    if (projectId === this.selectedProjectId()) this.records.set(records);
    await this.refreshManifests();
  }

  public async importRecord(input: unknown): Promise<string> {
    const draft: RamenModel = RamenModel.import(input);
    const model: Model = draft.getModel();
    const inputManifest: CreateManifest = {
      name: model.name,
      description: '',
      metamodelName: RAMEN_MODEL.name,
      metamodelId: RAMEN_MODEL.id,
      metamodelVersion: RAMEN_MODEL.version,
    };
    const manifest: Manifest = await this.createProject(inputManifest, RAMEN_MODEL);
    await this.saveModels(manifest.projectId, draft.getModels());
    return manifest.projectId;
  }

  private createRecord(projectId: string, model: Model, slot: number): ModelRecord {
    const timestamp: string = new Date().toISOString();
    return {
      projectId,
      modelId: new ShortUniqueId({ length: 18 }).randomUUID(),
      name: model.name,
      gmodel: model,
      slot,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}
