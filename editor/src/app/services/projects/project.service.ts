import { computed, effect, inject, Injectable, type Signal, signal, type WritableSignal } from '@angular/core';
import { type Model } from '@ramen-suite/core/model';
import { RamenModel, RAMEN_MODEL } from '@ramen-suite/core/ramen';
import { Subject, type Observable } from 'rxjs';
import { type CreateManifest, type Manifest, type UpdateManifest } from '../../models/Manifest';
import { type ModelRecord, type ViewSettings } from '../../models/ModelRecord';
import { indexBy } from '../../utils/collections';
import { readProjectForEditing, type ImportedProject } from '../../utils/project-import';
import { ProjectRepositoryService } from './project-repository.service';

/** Coordinates project loading and mutations, exposing the selected project’s reactive state. */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly repository: ProjectRepositoryService = inject(ProjectRepositoryService);

  private readonly modelChanges: Subject<string> = new Subject<string>();
  public readonly modelChanges$: Observable<string> = this.modelChanges.asObservable();
  public readonly manifests: WritableSignal<Manifest[]> = signal([]);
  public readonly records: WritableSignal<ModelRecord[]> = signal([]);
  public readonly selectedProjectId: WritableSignal<string | null> = signal(null);
  public readonly loadedProjectId: WritableSignal<string | null> = signal(null);
  public readonly selectedManifest: WritableSignal<Manifest | null> = signal(null);
  public readonly error: WritableSignal<string | null> = signal(null);

  public readonly recordsByLevelIndex: Signal<ReadonlyMap<number, ModelRecord>> = computed(
    (): ReadonlyMap<number, ModelRecord> => indexBy(this.records(), (record: ModelRecord): number => record.levelIndex),
  );
  public readonly recordsByModelId: Signal<ReadonlyMap<string, ModelRecord>> = computed(
    (): ReadonlyMap<string, ModelRecord> => indexBy(this.records(), (record: ModelRecord): string => record.gmodel.id),
  );
  public readonly modelsById: Signal<ReadonlyMap<string, Model>> = computed(
    (): ReadonlyMap<string, Model> =>
      indexBy(
        this.records().map((record: ModelRecord): Model => record.gmodel),
        (model: Model): string => model.id,
      ),
  );

  public constructor() {
    effect((): void => {
      const projectId: string | null = this.selectedProjectId();
      this.loadedProjectId.set(null);
      this.records.set([]);
      this.selectedManifest.set(null);
      if (projectId) void this.loadProject(projectId).catch((error: unknown): void => this.reportError(error));
    });
  }

  public reportError(error: unknown): void {
    this.error.set(error instanceof Error ? error.message : 'The operation could not be completed.');
  }

  public async projectExists(id: string): Promise<boolean> {
    return (await this.repository.find(id)) !== undefined;
  }

  public selectProject(id: string | null): void {
    this.selectedProjectId.set(id);
  }

  public async refreshManifests(): Promise<void> {
    this.manifests.set(await this.repository.list());
  }

  public async createProject(input: CreateManifest, example?: Model): Promise<Manifest> {
    const draft: RamenModel = example ? RamenModel.load(example, [RAMEN_MODEL]) : RamenModel.create(input.name);
    return this.persistProject(input, draft.getModels());
  }

  public async updateProject(id: string, patch: UpdateManifest): Promise<void> {
    await this.repository.update(id, patch);
    await this.refreshManifests();
    const manifest: Manifest | undefined = await this.repository.find(id);
    if (id === this.selectedProjectId()) this.selectedManifest.set(manifest ?? null);
  }

  public async duplicateProject(id: string): Promise<void> {
    await this.repository.duplicate(id);
    await this.refreshManifests();
  }

  public async removeProject(id: string): Promise<void> {
    await this.repository.remove(id);
    this.modelChanges.next(id);
    if (this.selectedProjectId() === id) this.selectProject(null);
    await this.refreshManifests();
  }

  public async getProjectRevision(id: string): Promise<string> {
    return this.repository.revision(id);
  }

  public async saveModels(projectId: string, models: readonly Model[]): Promise<void> {
    const records: ModelRecord[] = await this.repository.saveModels(projectId, models);
    this.modelChanges.next(projectId);
    if (projectId === this.selectedProjectId()) this.records.set(records);
    await this.refreshManifests();
  }

  public async updateView(id: string, patch: Partial<ViewSettings>): Promise<void> {
    const view: ViewSettings = await this.repository.updateView(id, patch);
    this.records.update((records: ModelRecord[]): ModelRecord[] =>
      records.map((record: ModelRecord): ModelRecord => (record.modelId === id ? { ...record, view } : record)),
    );
  }

  public async importProject(input: unknown): Promise<string> {
    const { root: model, models, project }: ImportedProject = readProjectForEditing(input);
    const inputManifest: CreateManifest = {
      name: project?.name ?? model.name,
      description: project?.description ?? '',
      metamodelName: RAMEN_MODEL.name,
      metamodelId: RAMEN_MODEL.id,
      metamodelVersion: RAMEN_MODEL.version,
    };
    const manifest: Manifest = await this.persistProject(inputManifest, models);
    return manifest.projectId;
  }

  private async loadProject(id: string): Promise<void> {
    const [manifest, records]: [Manifest | undefined, ModelRecord[]] = await Promise.all([
      this.repository.find(id),
      this.repository.loadRecords(id),
    ]);
    if (this.selectedProjectId() !== id) return;
    if (!manifest) throw new Error('Project not found.');

    this.selectedManifest.set(manifest);
    this.records.set(records);
    this.loadedProjectId.set(id);
  }

  private async persistProject(input: CreateManifest, models: readonly Model[]): Promise<Manifest> {
    const manifest: Manifest = await this.repository.create(input, models);
    await this.refreshManifests();
    return manifest;
  }
}
