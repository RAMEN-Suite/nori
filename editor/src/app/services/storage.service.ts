import { computed, effect, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Manifest } from '../models/Manifest';
import { ModelRecord } from '../models/ModelRecord';
import { database } from '../app.database';
import { environment } from '../../environments/environment';
import ShortUniqueId from 'short-unique-id';
import { GModel, Id, Import } from '@ramen-suite/core/gcore';

export type CreateManifest = Pick<
  Manifest,
  'name' | 'description' | 'metamodelName' | 'metamodelId' | 'metamodelVersion'
>;
export type UpdateManifest = Pick<Manifest, 'name' | 'description'>;

export type CreateRecordInput = Pick<ModelRecord, 'projectId' | 'gmodel' | 'name'>;
export type UpdateRecordInput = Partial<Pick<ModelRecord, 'gmodel' | 'name' | 'view'>>;

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  public readonly manifests: WritableSignal<Manifest[]> = signal([]);
  public readonly records: WritableSignal<ModelRecord[]> = signal([]);

  public readonly selectedProjectId: WritableSignal<string | null> = signal(null);
  public readonly selectedManifest: WritableSignal<Manifest | null> = signal(null);

  public readonly recordsBySlot: Signal<Map<number, ModelRecord>> = computed((): Map<number, ModelRecord> => {
    const map: Map<number, ModelRecord> = new Map<number, ModelRecord>();
    for (const record of this.records()) map.set(record.slot, record);
    return map;
  });

  public readonly modelsById: Signal<ReadonlyMap<Id, GModel>> = computed((): ReadonlyMap<Id, GModel> => {
    const map: Map<Id, GModel> = new Map<Id, GModel>();
    for (const record of this.records()) map.set(record.gmodel.id, record.gmodel);
    return map;
  });

  constructor() {
    effect((): void => {
      const pid: string | null = this.selectedProjectId();

      if (!pid) {
        this.selectedManifest.set(null);
        this.records.set([]);
        return;
      }

      void this.initProject(pid);
    });
  }

  public async isProjectExisting(projectId: string): Promise<boolean> {
    return !!(await database.manifests.get(projectId));
  }

  public selectProject(projectId: string | null): void {
    this.selectedProjectId.set(projectId);
  }

  public async refreshManifests(): Promise<void> {
    const list: Manifest[] = await database.manifests.orderBy('updatedAt').reverse().toArray();
    this.manifests.set(list);
  }

  public async createProject(input: CreateManifest, metamodel: GModel, example?: GModel): Promise<Manifest> {
    const timestamp: string = new Date().toISOString();
    const projectId: string = new ShortUniqueId({ length: 18 }).randomUUID();

    const manifestVersion: string = environment.manifestVersion;
    const appVersion: string = environment.appVersion;

    const manifest: Manifest = {
      projectId,
      ...input,
      manifestVersion,
      appVersion,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await database.transaction('rw', database.manifests, database.models, async (): Promise<void> => {
      await database.manifests.add(manifest);
      await this.createRecord({ projectId, name: metamodel.name, gmodel: metamodel });
      if (example) await this.createRecord({ projectId, name: example.name, gmodel: example });
    });

    await this.refreshManifests();
    return manifest;
  }

  public async updateProject(projectId: string, patch: UpdateManifest): Promise<void> {
    const updatedAt: string = new Date().toISOString();
    await database.manifests.update(projectId, { ...patch, updatedAt });

    if (this.selectedProjectId() === projectId) {
      await this.initProject(projectId);
    }

    await this.refreshManifests();
  }

  public async duplicateProject(projectId: string): Promise<void> {
    const sourceManifest: Manifest | undefined = await database.manifests.get(projectId);
    if (!sourceManifest) throw new Error(`Project not found: ${projectId}`);

    const sourceRecords: ModelRecord[] = await database.models.where('projectId').equals(projectId).toArray();

    const timestamp: string = new Date().toISOString();
    const newProjectId: string = new ShortUniqueId({ length: 18 }).randomUUID();

    const manifest: Manifest = {
      ...sourceManifest,
      name: `${sourceManifest.name} (copy)`,
      projectId: newProjectId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const clonedRecords: ModelRecord[] = sourceRecords.map(
      (existingModel: ModelRecord): ModelRecord => ({
        ...existingModel,
        modelId: new ShortUniqueId({ length: 18 }).randomUUID(),
        projectId: newProjectId,
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );

    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.manifests.add(manifest);
      await database.models.bulkAdd(clonedRecords);
    });

    await this.refreshManifests();
  }

  public async removeProject(projectId: string): Promise<void> {
    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.models.where('projectId').equals(projectId).delete();
      await database.manifests.delete(projectId);
    });

    await this.refreshManifests();
  }

  public async initProject(projectId: string): Promise<void> {
    const [manifest, records]: [Manifest | undefined, ModelRecord[]] = await Promise.all([
      database.manifests.get(projectId),
      database.models.where('projectId').equals(projectId).toArray(),
    ]);

    this.selectedManifest.set(manifest ?? null);
    records.sort((a: ModelRecord, b: ModelRecord): number => a.slot - b.slot);
    this.records.set(records);
  }

  public async createRecord(input: CreateRecordInput): Promise<void> {
    const timestamp: string = new Date().toISOString();
    const modelId: string = new ShortUniqueId({ length: 18 }).randomUUID();
    const slot: number = (await this.getLastSlot(input.projectId)) + 1;
    const revision: number = 1;

    const record: ModelRecord = {
      modelId,
      slot,
      ...input,
      revision,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.models.add(record);
      await database.manifests.update(input.projectId, { updatedAt: timestamp });
    });

    if (this.selectedProjectId() === input.projectId) {
      await this.initProject(input.projectId);
    }

    await this.refreshManifests();
  }

  public async importRecord(gmodel: GModel): Promise<void> {
    const projectId: string | null = this.selectedProjectId();
    if (!projectId) throw new Error('No active project.');

    const lastSlot: number = await this.getLastSlot(projectId);
    const lastRecord: ModelRecord | undefined = await this.getRecordBySlot(projectId, lastSlot);

    if (!lastRecord) throw new Error(`Last record not found for slot ${lastSlot}.`);
    if (gmodel.imports.length === 0) throw new Error('Import failed: GModel has no imports.');

    const lastModelId: string = lastRecord.gmodel.id;
    const matchingImports: Import[] = gmodel.imports.filter((i: Import): boolean => i.modelId === lastModelId);

    if (matchingImports.length !== 1) {
      const importIds: string = gmodel.imports.map((i: Import): string => i.modelId).join(', ');
      throw new Error(
        `Import mismatch: expected exactly 1 import referencing last slot modelId=${lastModelId}, ` +
          `but found ${matchingImports.length}. imports=[${importIds}]`,
      );
    }

    await this.createRecord({ projectId, name: gmodel.name, gmodel });
  }

  public async updateRecord(modelId: string, patch: UpdateRecordInput): Promise<void> {
    const existing: ModelRecord | undefined = await database.models.get(modelId);
    if (!existing) throw new Error(`Model not found: ${modelId}`);

    const updatedAt: string = new Date().toISOString();
    const updated: ModelRecord = {
      ...existing,
      ...patch,
      updatedAt,
      revision: existing.revision + 1,
    };

    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.models.put(updated);
      await database.manifests.update(existing.projectId, { updatedAt });
    });

    if (this.selectedProjectId() === existing.projectId) {
      await this.initProject(existing.projectId);
    }

    await this.refreshManifests();
  }

  public async removeSlot(projectId: string, slot: number): Promise<void> {
    const record: ModelRecord | undefined = await this.getRecordBySlot(projectId, slot);
    if (!record) return;

    const isAllowed: boolean = await this.canRemoveSlot(projectId, slot);
    if (!isAllowed) throw new Error(`Cannot delete slot ${slot}: higher slots exist.`);
    await this.removeRecord(record.modelId);
  }

  private async removeRecord(modelId: string): Promise<void> {
    const existing: ModelRecord | undefined = await database.models.get(modelId);
    if (!existing) return;

    const updatedAt: string = new Date().toISOString();
    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.models.delete(modelId);
      await database.manifests.update(existing.projectId, { updatedAt });
    });

    if (this.selectedProjectId() === existing.projectId) {
      await this.initProject(existing.projectId);
    }

    await this.refreshManifests();
  }

  public async getLastSlot(projectId: string): Promise<number> {
    const records: ModelRecord[] = await database.models.where('projectId').equals(projectId).sortBy('slot');
    return records[records.length - 1]?.slot ?? -1;
  }

  private async canRemoveSlot(projectId: string, slot: number): Promise<boolean> {
    const records: ModelRecord[] = await database.models.where('projectId').equals(projectId).toArray();
    const maxSlot: number = records.reduce((max: number, m: ModelRecord): number => Math.max(max, m.slot), -1);
    return maxSlot <= slot;
  }

  private async getRecordBySlot(projectId: string, slot: number): Promise<ModelRecord | undefined> {
    return database.models.where('[projectId+slot]').equals([projectId, slot]).first();
  }
}
