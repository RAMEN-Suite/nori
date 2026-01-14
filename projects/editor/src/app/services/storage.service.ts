import { computed, effect, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Manifest } from '../models/Manifest';
import { Model } from '../models/Model';
import { database } from '../app.database';
import { environment } from '../../environments/environment';
import ShortUniqueId from 'short-unique-id';
import { GModel } from '../models/GModel';

export type CreateManifest = Pick<Manifest, 'name' | 'description' | 'metamodelId' | 'metaVersion'>;
export type UpdateManifest = Pick<Manifest, 'name' | 'description'>;

type CreateModelInput = Pick<Model, 'projectId' | 'gmodel' | 'name' | 'description'>;
type UpdateModelInput = Pick<Model, 'gmodel' | 'name' | 'description'>;

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  public readonly manifests: WritableSignal<Manifest[]> = signal([]);
  public readonly models: WritableSignal<Model[]> = signal([]);

  public readonly selectedProjectId: WritableSignal<string | null> = signal(null);
  public readonly selectedManifest: WritableSignal<Manifest | null> = signal(null);

  public readonly modelsBySlot: Signal<Map<number, Model>> = computed((): Map<number, Model> => {
    const map: Map<number, Model> = new Map<number, Model>();
    for (const model of this.models()) {
      map.set(model.slot, model);
    }
    return map;
  });

  constructor() {
    effect((): void => {
      const pid: string | null = this.selectedProjectId();

      if (!pid) {
        this.selectedManifest.set(null);
        this.models.set([]);
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

  public async createProject(input: CreateManifest, metamodel: GModel): Promise<void> {
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

    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.manifests.add(manifest);
      await this.createModel({
        projectId,
        name: metamodel.name,
        description: '',
        gmodel: metamodel,
      });
    });

    this.selectProject(projectId);
    await this.refreshManifests();
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

    const sourceModels: Model[] = await database.models
      .where('projectId')
      .equals(projectId)
      .toArray();

    const timestamp: string = new Date().toISOString();
    const newProjectId: string = new ShortUniqueId({ length: 18 }).randomUUID();

    const manifest: Manifest = {
      ...sourceManifest,
      name: `${sourceManifest.name} (copy)`,
      projectId: newProjectId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const clonedModels: Model[] = sourceModels.map(
      (existingModel: Model): Model => ({
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
      await database.models.bulkAdd(clonedModels);
    });

    await this.refreshManifests();
  }

  public async deleteProject(projectId: string): Promise<void> {
    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.models.where('projectId').equals(projectId).delete();
      await database.manifests.delete(projectId);
    });

    await this.refreshManifests();
  }

  public async initProject(projectId: string): Promise<void> {
    const [manifest, models]: [Manifest | undefined, Model[]] = await Promise.all([
      database.manifests.get(projectId),
      database.models.where('projectId').equals(projectId).toArray(),
    ]);

    this.selectedManifest.set(manifest ?? null);
    models.sort((a: Model, b: Model): number => a.slot - b.slot);
    this.models.set(models);
  }

  public async createModel(input: CreateModelInput): Promise<void> {
    const timestamp: string = new Date().toISOString();
    const modelId: string = new ShortUniqueId({ length: 18 }).randomUUID();
    const slot: number = (await this.getLastSlot(input.projectId)) + 1;
    const revision: number = 1;

    const model: Model = {
      modelId,
      slot,
      ...input,
      revision,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.models.add(model);
      await database.manifests.update(input.projectId, { updatedAt: timestamp });
    });

    if (this.selectedProjectId() === input.projectId) {
      await this.initProject(input.projectId);
    }

    await this.refreshManifests();
  }

  public async updateModel(modelId: string, patch: UpdateModelInput): Promise<void> {
    const existing: Model | undefined = await database.models.get(modelId);
    if (!existing) throw new Error(`Model not found: ${modelId}`);

    const updatedAt: string = new Date().toISOString();
    const updated: Model = { ...existing, ...patch, updatedAt, revision: existing.revision + 1 };

    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.models.put(updated);
      await database.manifests.update(existing.projectId, { updatedAt });
    });

    if (this.selectedProjectId() === existing.projectId) {
      await this.initProject(existing.projectId);
    }

    await this.refreshManifests();
  }

  public async deleteSlot(projectId: string, slot: number): Promise<void> {
    const model: Model | undefined = await this.getModelBySlot(projectId, slot);
    if (!model) return;

    const isAllowed: boolean = await this.canDeleteSlot(projectId, slot);
    if (!isAllowed) throw new Error(`Cannot delete slot ${slot}: higher slots exist.`);
    await this.deleteModel(model.modelId);
  }

  private async deleteModel(modelId: string): Promise<void> {
    const existing: Model | undefined = await database.models.get(modelId);
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

  public async canDeleteSlot(projectId: string, slot: number): Promise<boolean> {
    const models: Model[] = await database.models.where('projectId').equals(projectId).toArray();
    const maxSlot: number = models.reduce((max: number, m: Model) => Math.max(max, m.slot), -1);
    return maxSlot <= slot;
  }

  public async getModelBySlot(projectId: string, slot: number): Promise<Model | undefined> {
    return database.models.where('[projectId+slot]').equals([projectId, slot]).first();
  }

  public async getLastSlot(projectId: string): Promise<number> {
    const models: Model[] = await database.models
      .where('projectId')
      .equals(projectId)
      .sortBy('slot');

    return models[models.length - 1]?.slot ?? -1;
  }
}
