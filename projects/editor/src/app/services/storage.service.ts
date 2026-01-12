import { computed, effect, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Manifest } from '../models/Manifest';
import { Model } from '../models/Model';
import { database } from '../app.database';
import { environment } from '../../environments/environment';
import ShortUniqueId from 'short-unique-id';

export type CreateManifest = Pick<Manifest, 'name' | 'description' | 'metamodelId' | 'metaVersion'>;
export type UpdateManifest = Pick<Manifest, 'name' | 'description'>;

export type CreateModel = Pick<Model, 'projectId' | 'slot' | 'gmodel' | 'name' | 'description'>;
export type UpdateModel = Omit<Model, 'modelId' | 'projectId' | 'revision'>;

const sortModelsInSlot: (a: Model, b: Model) => number = (a: Model, b: Model): number => {
  if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
  return a.modelId.localeCompare(b.modelId);
};

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  public readonly manifests: WritableSignal<Manifest[]> = signal([]);
  public readonly models: WritableSignal<Model[]> = signal([]);

  public readonly selectedProjectId: WritableSignal<string | null> = signal(null);
  public readonly selectedManifest: WritableSignal<Manifest | null> = signal(null);

  constructor() {
    effect((): void => {
      const pid: string | null = this.selectedProjectId();

      if (!pid) {
        this.selectedManifest.set(null);
        this.models.set([]);
        return;
      }

      void this.loadProject(pid);
    });
  }

  public modelsBySlot: Signal<Map<number, Model[]>> = computed((): Map<number, Model[]> => {
    const map: Map<number, Model[]> = new Map<number, Model[]>();

    for (const model of this.models()) {
      const array: Model[] = map.get(model.slot) ?? [];
      array.push(model);
      map.set(model.slot, array);
    }

    return map;
  });

  public async refreshManifests(): Promise<void> {
    const list: Manifest[] = await database.manifests.orderBy('updatedAt').reverse().toArray();
    this.manifests.set(list);
  }

  public selectProject(projectId: string | null): void {
    this.selectedProjectId.set(projectId);
  }

  public async createProject(input: CreateManifest): Promise<void> {
    const createdAt: string = new Date().toISOString();
    const updatedAt: string = new Date().toISOString();

    const projectId: string = new ShortUniqueId({ length: 18 }).randomUUID();
    const manifestVersion: string = environment.manifestVersion;
    const appVersion: string = environment.appVersion;

    const manifest: Manifest = {
      projectId,
      ...input,
      manifestVersion,
      appVersion,
      createdAt,
      updatedAt,
    };

    await database.manifests.add(manifest);
    await this.refreshManifests();
    this.selectProject(manifest.projectId);
  }

  public async updateProject(projectId: string, patch: UpdateManifest): Promise<void> {
    const updatedAt: string = new Date().toISOString();
    await database.manifests.update(projectId, { ...patch, updatedAt });

    if (this.selectedProjectId() === projectId) {
      await this.loadProject(projectId);
    }

    await this.refreshManifests();
  }

  public async loadProject(projectId: string): Promise<void> {
    const [manifest, models]: [Manifest | undefined, Model[]] = await Promise.all([
      database.manifests.get(projectId),
      database.models.where('projectId').equals(projectId).toArray(),
    ]);

    this.selectedManifest.set(manifest ?? null);

    models.sort((a: Model, b: Model): number => {
      if (a.slot !== b.slot) return a.slot - b.slot;
      return sortModelsInSlot(a, b);
    });

    this.models.set(models);
  }

  public async createModel(input: CreateModel): Promise<string> {
    const createdAt: string = new Date().toISOString();
    const updatedAt: string = new Date().toISOString();
    const modelId: string = new ShortUniqueId({ length: 18 }).randomUUID();
    const revision: number = 1;

    const model: Model = {
      modelId,
      ...input,
      revision,
      createdAt,
      updatedAt,
    };

    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.models.add(model);
      await database.manifests.update(input.projectId, { updatedAt });
    });

    if (this.selectedProjectId() === input.projectId) {
      await this.loadProject(input.projectId);
    }

    await this.refreshManifests();
    return modelId;
  }

  public async updateModel(modelId: string, patch: UpdateModel): Promise<void> {
    const existing: Model | undefined = await database.models.get(modelId);
    if (!existing) throw new Error(`Model not found: ${modelId}`);

    const updatedAt: string = new Date().toISOString();
    const updated: Model = { ...existing, ...patch, updatedAt, revision: existing.revision + 1 };

    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.models.put(updated);
      await database.manifests.update(existing.projectId, { updatedAt });
    });

    if (this.selectedProjectId() === existing.projectId) {
      await this.loadProject(existing.projectId);
    }

    await this.refreshManifests();
  }

  public async listModelsBySlot(projectId: string, slot: number): Promise<Model[]> {
    const rows: Model[] = await database.models
      .where('[projectId+slot]')
      .equals([projectId, slot])
      .toArray();

    rows.sort(sortModelsInSlot);
    return rows;
  }

  public async deleteModel(modelId: string): Promise<void> {
    const existing: Model | undefined = await database.models.get(modelId);
    if (!existing) return;

    const updatedAt: string = new Date().toISOString();

    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.models.delete(modelId);
      await database.manifests.update(existing.projectId, { updatedAt });
    });

    if (this.selectedProjectId() === existing.projectId) {
      await this.loadProject(existing.projectId);
    }

    await this.refreshManifests();
  }

  public async deleteProject(projectId: string): Promise<void> {
    await database.transaction('rw', database.manifests, database.models, async () => {
      await database.models.where('projectId').equals(projectId).delete();
      await database.manifests.delete(projectId);
    });

    if (this.selectedProjectId() === projectId) {
      this.selectProject(null);
    }

    await this.refreshManifests();
  }
}
