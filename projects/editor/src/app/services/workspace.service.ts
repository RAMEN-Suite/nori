import {
  computed,
  effect,
  inject,
  Injectable,
  Signal,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { Bounds, GAttribute, GDataType, GModel, GNode, GRelation } from '../models/GModel';
import { SuggestionHelper } from '../core/validation/helper/SuggestionHelper';
import { ModelValidator, ValidationResult } from '../core/validation/ModelValidator';
import { StorageService } from './storage.service';
import { Model } from '../models/Model';
import { GModelMutations } from '../core/GModelMutations';
import { GModelFactory } from '../core/GModelFactory';
import { WorkspaceState } from '../states/workspace.state';

export type CreateModelInput = {
  uri: string;
  name: string;
  slug: string;
  version: string;
  description: string;
};

@Injectable({
  providedIn: 'root',
})
export class WorkspaceService {
  private readonly storage: StorageService = inject(StorageService);
  private readonly workspaceState: WorkspaceState = inject(WorkspaceState);

  private readonly suggest: SuggestionHelper = new SuggestionHelper();
  private readonly validator: ModelValidator = new ModelValidator();

  public readonly selectedDerivedSlot: WritableSignal<number> = signal(1);
  public readonly activeDraft: WritableSignal<GModel | null> = signal(null);

  private readonly baseSlot: Signal<number> = computed((): number => {
    return this.selectedDerivedSlot() - 1;
  });

  public readonly baseModel: Signal<GModel | null> = computed((): GModel | null => {
    const model: Model | undefined = this.storage.modelsBySlot().get(this.baseSlot());
    return model?.gmodel ?? null;
  });

  public readonly derivedModel: Signal<GModel | null> = computed((): GModel | null => {
    const model: Model | undefined = this.storage.modelsBySlot().get(this.selectedDerivedSlot());
    return model?.gmodel ?? null;
  });

  public readonly baseId: Signal<string> = computed((): string => {
    return this.baseModel()?.id ?? '';
  });

  public readonly validation: Signal<ValidationResult> = computed((): ValidationResult => {
    const base: GModel | null = this.baseModel();
    const derivedDraft: GModel | null = this.activeDraft();

    if (!base || !derivedDraft) return { diagnostics: [], hasErrors: false };
    return this.validator.validate(base, derivedDraft);
  });

  public readonly baseNodes: Signal<ReadonlyArray<GNode>> = computed((): ReadonlyArray<GNode> => {
    const base: GModel | null = this.baseModel();
    if (!base) return [];
    return this.suggest.listNodes(base);
  });

  public readonly derivedNodes: Signal<ReadonlyArray<GNode>> = computed(
    (): ReadonlyArray<GNode> => {
      const derived: GModel | null = this.derivedModel();
      if (!derived) return [];
      return this.suggest.listNodes(derived);
    },
  );

  public readonly baseRelations: Signal<ReadonlyArray<GRelation>> = computed(
    (): ReadonlyArray<GRelation> => {
      const base: GModel | null = this.baseModel();
      if (!base) return [];
      return this.suggest.listRelations(base);
    },
  );

  public readonly dataTypes: Signal<ReadonlyArray<GDataType>> = computed(
    (): ReadonlyArray<GDataType> => {
      const base: GModel | null = this.baseModel();
      const derived: GModel | null = this.activeDraft();
      if (!base || !derived) return [];
      return this.suggest.listAllDataTypes(base, derived, this.baseId());
    },
  );

  public readonly derivedTypes: Signal<ReadonlyArray<GDataType>> = computed(
    (): ReadonlyArray<GDataType> => {
      const derived: GModel | null = this.derivedModel();
      if (!derived) return [];
      return this.suggest.listDataTypes(derived);
    },
  );

  constructor() {
    effect((): void => {
      const modelsBySlot: Map<number, Model> = this.storage.modelsBySlot();
      if (modelsBySlot.size === 0) return;

      const slot: number = this.selectedDerivedSlot();
      if (!modelsBySlot.has(slot)) this.selectDerivedSlot(1);
    });

    effect((): void => {
      const derived: GModel | null = this.derivedModel();
      const isDirty: boolean = untracked((): boolean => this.workspaceState.state().isDirty);

      if (isDirty) return;

      this.activeDraft.set(derived ? structuredClone(derived) : null);
      this.workspaceState.isDirty(false);
    });
  }

  public selectDerivedSlot(slot: number): void {
    this.selectedDerivedSlot.set(slot);
  }

  public listAllowedFromRelations(fromNodeId: string): ReadonlyArray<GRelation> {
    const base: GModel | null = this.baseModel();
    const derived: GModel | null = this.activeDraft();
    if (!base || !derived) return [];
    return this.suggest.listAllowedFromRelations(base, derived, this.baseId(), fromNodeId);
  }

  public listAllowedToNodes(baseRelationId: string): ReadonlyArray<GNode> {
    const base: GModel | null = this.baseModel();
    const derived: GModel | null = this.activeDraft();
    if (!base || !derived) return [];
    return this.suggest.listAllowedToNodes(base, derived, this.baseId(), baseRelationId);
  }

  public listForbiddenAttributeNames(nodeId: string): ReadonlySet<string> {
    const base: GModel | null = this.baseModel();
    const derived: GModel | null = this.activeDraft();
    if (!base || !derived) return new Set<string>();
    return this.suggest.listForbiddenAttributeNames(base, derived, this.baseId(), nodeId);
  }

  public addNode(name: string, baseNodeId: string): void {
    const node: GNode = this.suggest.createDerivedNode(this.baseId(), { name, baseNodeId });
    this.updateDraft((d: GModel): GModel => GModelMutations.addClassifier(d, node));
  }

  public addDataType(name: string): void {
    const dt: GDataType = this.suggest.createDataType({ name });
    this.updateDraft((d: GModel): GModel => GModelMutations.addClassifier(d, dt));
  }

  public addAttribute(nodeId: string, name: string, typeId: string, bounds?: Bounds): void {
    const attr: GAttribute = this.suggest.createAttribute({ name, typeId, bounds });
    this.updateDraft((d: GModel): GModel => GModelMutations.addAttribute(d, nodeId, attr));
  }

  public addRelation(baseRelationId: string, fromNodeId: string, toNodeId: string): void {
    const base: GModel | null = this.baseModel();
    if (!base) throw new Error('No base loaded.');

    const rel: GRelation = this.suggest.createDerivedRelation(base, this.baseId(), {
      baseRelationId,
      fromNodeId,
      toNodeId,
    });

    this.updateDraft((d: GModel): GModel => GModelMutations.addRelation(d, rel));
  }

  public updateModel(patch: CreateModelInput): void {
    this.updateDraft((draft: GModel) => ({
      ...draft,
      name: patch.name ?? draft.name,
      version: patch.version ?? draft.version,
    }));
  }

  public async createModel(input: CreateModelInput): Promise<void> {
    if (this.workspaceState.state().isDirty) return;

    const pid: string | null = this.storage.selectedProjectId();
    if (!pid) throw new Error('No active project selected.');

    const slot: number = await this.storage.getLastSlot(pid);

    const base: GModel | null = this.storage.modelsBySlot().get(slot)?.gmodel ?? null;
    if (!base) throw new Error(`Base model missing for slot ${slot}.`);

    const gmodel: GModel = GModelFactory.deriveModel(base, {
      schemaId: input.uri,
      id: input.slug,
      name: input.name,
      version: input.version,
    });

    await this.storage.createModel({
      projectId: pid,
      gmodel,
      name: input.name,
      description: input.description,
    });

    this.selectedDerivedSlot.set(slot + 1);
    this.workspaceState.isDirty(false);
  }

  public async saveDraftToActiveSlot(): Promise<void> {
    const pid: string | null = this.storage.selectedProjectId();
    const slot: number = this.selectedDerivedSlot();
    const draft: GModel | null = this.activeDraft();
    const row: Model | undefined = this.storage.modelsBySlot().get(slot);

    if (!pid || !draft || !row) throw new Error('Cannot save (missing state).');

    await this.storage.updateModel(row.modelId, {
      gmodel: draft,
      name: row.name,
      description: row.description,
    });

    this.workspaceState.isDirty(false);
  }

  private updateDraft(mutator: (draft: GModel) => GModel): void {
    const draft: GModel | null = this.activeDraft();
    if (!draft) throw new Error('No draft loaded.');

    const updated: GModel = mutator(draft);
    this.activeDraft.set(updated);
    this.workspaceState.isDirty(true);
  }
}
