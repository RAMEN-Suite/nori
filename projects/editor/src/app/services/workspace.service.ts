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
import { GDataType, GModel, GNode, GRelation } from '../core/models/GModel';
import { SuggestionHelper } from '../core/validation/helper/SuggestionHelper';
import { ModelValidator, ValidationResult } from '../core/validation/ModelValidator';
import { StorageService } from './storage.service';
import { Model } from '../models/Model';
import { GModelFactory } from '../core/GModelFactory';
import { WorkspaceState } from '../states/workspace.state';
import { GModelOperations } from '../core/GModelOperations';
import { GModelMutations, PatchDataType, PatchNode, PatchRelation } from '../core/GModelMutations';

export type CreateModelInput = {
  uri: string;
  name: string;
  slug: string;
  version: string;
  description: string;
};

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly storage: StorageService = inject(StorageService);
  private readonly workspaceState: WorkspaceState = inject(WorkspaceState);

  private readonly suggest: SuggestionHelper = new SuggestionHelper();
  private readonly validator: ModelValidator = new ModelValidator();

  public readonly selectedDerivedNodeId: WritableSignal<string> = signal('');
  public readonly selectedDerivedSlot: WritableSignal<number> = signal(1);
  public readonly activeDraft: WritableSignal<GModel | null> = signal(null);

  private readonly baseSlot: Signal<number> = computed(
    (): number => this.selectedDerivedSlot() - 1,
  );

  public readonly baseModel: Signal<GModel | null> = computed((): GModel | null => {
    const model: Model | undefined = this.storage.modelsBySlot().get(this.baseSlot());
    return model?.gmodel ?? null;
  });

  public readonly derivedModel: Signal<GModel | null> = computed((): GModel | null => {
    const model: Model | undefined = this.storage.modelsBySlot().get(this.selectedDerivedSlot());
    return model?.gmodel ?? null;
  });

  public readonly baseId: Signal<string> = computed((): string => this.baseModel()?.id ?? '');

  public readonly validation: Signal<ValidationResult> = computed((): ValidationResult => {
    const base: GModel | null = this.baseModel();
    const draft: GModel | null = this.activeDraft();
    if (!base || !draft) return { diagnostics: [], hasErrors: false };
    return this.validator.validate(base, draft);
  });

  public readonly baseNodes: Signal<GNode[]> = computed((): GNode[] => {
    const base: GModel | null = this.baseModel();
    return base ? Array.from(this.suggest.listNodes(base)) : [];
  });

  public readonly draftNodes: Signal<GNode[]> = computed((): GNode[] => {
    const draft: GModel | null = this.activeDraft();
    return draft ? Array.from(this.suggest.listNodes(draft)) : [];
  });

  public readonly baseRelations: Signal<GRelation[]> = computed((): GRelation[] => {
    const base: GModel | null = this.baseModel();
    return base ? Array.from(this.suggest.listRelations(base)) : [];
  });

  public readonly dataTypes: Signal<GDataType[]> = computed((): GDataType[] => {
    const base: GModel | null = this.baseModel();
    const draft: GModel | null = this.activeDraft();
    if (!base || !draft) return [];
    return Array.from(this.suggest.listAllDataTypes(base, draft, this.baseId()));
  });

  public readonly draftTypes: Signal<GDataType[]> = computed((): GDataType[] => {
    const draft: GModel | null = this.activeDraft();
    return draft ? Array.from(this.suggest.listDataTypes(draft)) : [];
  });

  constructor() {
    effect((): void => {
      const modelsBySlot: Map<number, Model> = this.storage.modelsBySlot();
      if (modelsBySlot.size === 0) return;

      const slot: number = this.selectedDerivedSlot();
      if (!modelsBySlot.has(slot)) this.setSelectedSlot(1);
    });

    effect((): void => {
      const derived: GModel | null = this.derivedModel();
      const isDirty: boolean = untracked((): boolean => this.workspaceState.state().isDirty);
      if (isDirty) return;

      this.activeDraft.set(derived ? structuredClone(derived) : null);
      this.workspaceState.isDirty(false);
    });
  }

  public setSelectedDerivedNodeId(nodeId: string): void {
    this.selectedDerivedNodeId.set(nodeId);
  }

  public setSelectedSlot(slot: number): void {
    this.selectedDerivedSlot.set(slot);
  }

  public resetSelections(): void {
    this.selectedDerivedNodeId.set('');
    this.selectedDerivedSlot.set(1);
  }

  public resetDraft(): void {
    const derived: GModel | null = this.derivedModel();
    this.activeDraft.set(derived ? structuredClone(derived) : null);
    this.workspaceState.isDirty(false);
  }

  public async createNode(name: string, baseNodeId: string): Promise<GNode> {
    const node: GNode = this.suggest.createDerivedNode(this.baseId(), { name, baseNodeId });
    this.apply((m: GModel): GModel => GModelMutations.addClassifier(m, node));
    await this.saveDraftToActiveSlot();
    return node;
  }

  public async deleteNode(nodeId: string): Promise<void> {
    this.apply((m: GModel): GModel => GModelOperations.deleteNode(m, nodeId));
    await this.saveDraftToActiveSlot();

    if (this.selectedDerivedNodeId() === nodeId) {
      this.selectedDerivedNodeId.set('');
    }
  }

  public updateNode(nodeId: string, patch: PatchNode): void {
    this.apply((m: GModel): GModel => GModelMutations.updateNode(m, nodeId, patch));
  }

  public async createDataType(name: string): Promise<GDataType> {
    const dataType: GDataType = this.suggest.createDataType({ name });
    this.apply((m: GModel): GModel => GModelMutations.addClassifier(m, dataType));
    await this.saveDraftToActiveSlot();
    return dataType;
  }

  public deleteDataType(dataTypeId: string): void {
    this.apply((m: GModel): GModel => GModelOperations.deleteDataType(m, dataTypeId));
  }

  public updateDataType(dataTypeId: string, patch: PatchDataType): void {
    this.apply((m: GModel): GModel => GModelMutations.updateDataType(m, dataTypeId, patch));
  }

  public createRelation(baseRelationId: string, fromNodeId: string, toNodeId: string): GRelation {
    const base: GModel | null = this.baseModel();
    if (!base) throw new Error('No base loaded.');

    const relation: GRelation = this.suggest.createDerivedRelation(base, this.baseId(), {
      baseRelationId,
      fromNodeId,
      toNodeId,
    });

    this.apply((m: GModel): GModel => GModelMutations.addRelation(m, relation));
    return relation;
  }

  public updateRelation(relationId: string, patch: PatchRelation): void {
    this.apply((m: GModel): GModel => GModelMutations.updateRelation(m, relationId, patch));
  }

  public deleteRelation(relationId: string): void {
    this.apply((m: GModel): GModel => GModelMutations.removeRelationById(m, relationId));
  }

  public apply(mutator: (draft: GModel) => GModel): void {
    const draft: GModel | null = this.activeDraft();
    if (!draft) throw new Error('No draft loaded.');

    const updated: GModel = mutator(draft);
    this.activeDraft.set(updated);
    this.workspaceState.isDirty(true);
  }

  public listFromRelations(fromNodeId: string): GRelation[] {
    const base: GModel | null = this.baseModel();
    const draft: GModel | null = this.activeDraft();
    if (!base || !draft) return [];
    return Array.from(this.suggest.listFromRelations(base, draft, this.baseId(), fromNodeId));
  }

  public listToNodes(baseRelationId: string): GNode[] {
    const base: GModel | null = this.baseModel();
    const draft: GModel | null = this.activeDraft();
    if (!base || !draft) return [];
    return Array.from(this.suggest.listToNodes(base, draft, this.baseId(), baseRelationId));
  }

  public listForbiddenAttributes(nodeId: string): Set<string> {
    const base: GModel | null = this.baseModel();
    const draft: GModel | null = this.activeDraft();
    if (!base || !draft) return new Set<string>();
    return new Set(this.suggest.listForbiddenAttributes(base, draft, this.baseId(), nodeId));
  }

  public filteredDraftNodes(baseNodeId: string): Signal<GNode[]> {
    return computed((): GNode[] => {
      const draft: GModel | null = this.activeDraft();
      const base: GModel | null = this.baseModel();
      if (!base || !draft) return [];
      return Array.from(this.suggest.filterDerivedNodes(base, draft, baseNodeId));
    });
  }

  public async updateModelMeta(patch: Pick<CreateModelInput, 'name' | 'version'>): Promise<void> {
    this.apply((draft: GModel) => ({
      ...draft,
      name: patch.name ?? draft.name,
      version: patch.version ?? draft.version,
    }));
    await this.saveDraftToActiveSlot();
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
}
