import { Injectable } from '@angular/core';
import { type Model } from '@ramen-suite/core/model';
import ShortUniqueId from 'short-unique-id';
import { database } from '../../app.database';
import { type CreateManifest, type Manifest, type UpdateManifest } from '../../models/Manifest';
import { type ModelRecord, type ViewSettings } from '../../models/ModelRecord';
import { indexBy } from '../../utils/collections';
import { orderModelsByImports } from '../../utils/model-order';
import { environment } from '../../../environments/environment';

/** Owns atomic IndexedDB operations for projects, model records and their view preferences. */
@Injectable({ providedIn: 'root' })
export class ProjectRepositoryService {
  private readonly ids: ShortUniqueId = new ShortUniqueId({ length: 18 });

  public async list(): Promise<Manifest[]> {
    return database.manifests.orderBy('updatedAt').reverse().toArray();
  }

  public async find(id: string): Promise<Manifest | undefined> {
    return database.manifests.get(id);
  }

  public async loadRecords(projectId: string): Promise<ModelRecord[]> {
    return database.transaction('rw', database.models, async (): Promise<ModelRecord[]> => {
      const records: ModelRecord[] = await database.models.where('projectId').equals(projectId).sortBy('levelIndex');
      const byId: ReadonlyMap<string, ModelRecord> = indexBy(records, (record: ModelRecord): string => record.gmodel.id);
      const ordered: ModelRecord[] = orderModelsByImports(records.map((record): Model => record.gmodel)).map(
        (model: Model, levelIndex: number): ModelRecord => {
          const record: ModelRecord | undefined = byId.get(model.id);
          if (!record) throw new Error('Model record not found.');
          return { ...record, levelIndex };
        },
      );
      if (ordered.some((record): boolean => byId.get(record.gmodel.id)?.levelIndex !== record.levelIndex)) {
        await this.replaceRecords(projectId, ordered);
      }
      return ordered;
    });
  }

  public async revision(projectId: string): Promise<string> {
    const records: ModelRecord[] = await database.models.where('projectId').equals(projectId).sortBy('modelId');
    return JSON.stringify(records.map((record): readonly [string, number] => [record.modelId, record.revision]));
  }

  public async create(input: CreateManifest, models: readonly Model[]): Promise<Manifest> {
    const projectId: string = this.ids.randomUUID();
    const timestamp: string = new Date().toISOString();
    const manifest: Manifest = {
      ...input,
      projectId,
      createdAt: timestamp,
      updatedAt: timestamp,
      manifestVersion: environment.manifestVersion,
      appVersion: environment.appVersion,
    };
    const records: ModelRecord[] = orderModelsByImports(models).map(
      (model: Model, levelIndex: number): ModelRecord => this.createRecord(projectId, model, levelIndex, timestamp),
    );
    await database.transaction('rw', database.manifests, database.models, async (): Promise<void> => {
      await database.manifests.add(manifest);
      await database.models.bulkAdd(records);
    });
    return manifest;
  }

  public async update(id: string, patch: UpdateManifest): Promise<void> {
    await database.manifests.update(id, { ...patch, updatedAt: new Date().toISOString() });
  }

  public async duplicate(id: string): Promise<void> {
    await database.transaction('rw', database.manifests, database.models, async (): Promise<void> => {
      const source: Manifest | undefined = await this.find(id);
      if (!source) throw new Error('Project not found.');

      const projectId: string = this.ids.randomUUID();
      const timestamp: string = new Date().toISOString();
      const records: ModelRecord[] = await database.models.where('projectId').equals(id).toArray();

      await database.manifests.add({
        ...source,
        projectId,
        name: `${source.name} (copy)`,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await database.models.bulkAdd(
        records.map(
          (record: ModelRecord): ModelRecord => ({
            ...record,
            projectId,
            modelId: this.ids.randomUUID(),
            revision: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          }),
        ),
      );
    });
  }

  public async remove(id: string): Promise<void> {
    await database.transaction('rw', database.manifests, database.models, async (): Promise<void> => {
      await database.models.where('projectId').equals(id).delete();
      await database.manifests.delete(id);
    });
  }

  public async saveModels(
    projectId: string,
    models: readonly Model[],
    recoveredViews?: ReadonlyMap<string, ViewSettings>,
  ): Promise<ModelRecord[]> {
    return database.transaction('rw', database.manifests, database.models, async (): Promise<ModelRecord[]> => {
      if (!(await this.find(projectId))) throw new Error('Project not found.');

      const previous: ModelRecord[] = await database.models.where('projectId').equals(projectId).toArray();
      const byId: ReadonlyMap<string, ModelRecord> = indexBy(previous, (record: ModelRecord): string => record.gmodel.id);
      const timestamp: string = new Date().toISOString();
      const records: ModelRecord[] = orderModelsByImports(models).map((model: Model, levelIndex: number): ModelRecord => {
        const old: ModelRecord | undefined = byId.get(model.id);
        return old
          ? { ...old, levelIndex, gmodel: model, name: model.name, revision: old.revision + 1, updatedAt: timestamp }
          : {
              ...this.createRecord(projectId, model, levelIndex, timestamp),
              view: structuredClone(recoveredViews?.get(model.id)),
            };
      });

      await this.replaceRecords(projectId, records);
      await database.manifests.update(projectId, { updatedAt: timestamp });
      return records;
    });
  }

  public async updateView(id: string, patch: Partial<ViewSettings>): Promise<ViewSettings> {
    return database.transaction('rw', database.models, async (): Promise<ViewSettings> => {
      const record: ModelRecord | undefined = await database.models.get(id);
      if (!record) throw new Error('Model record not found.');

      const view: ViewSettings = { nodeColors: {}, ...record.view, ...patch };
      await database.models.update(id, { view });
      return view;
    });
  }

  private async replaceRecords(projectId: string, records: readonly ModelRecord[]): Promise<void> {
    await database.models.where('projectId').equals(projectId).delete();
    await database.models.bulkPut(records);
  }

  private createRecord(projectId: string, model: Model, levelIndex: number, timestamp: string): ModelRecord {
    return {
      projectId,
      modelId: this.ids.randomUUID(),
      name: model.name,
      levelIndex,
      gmodel: model,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}
