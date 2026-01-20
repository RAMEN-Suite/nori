import {
  computed,
  effect,
  inject,
  Injectable,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { GClassifier, GDataType, GModel, GNode, GRelation, Id } from '../core/models/GModel';
import { SuggestionHelper } from '../core/validation/helper/SuggestionHelper';
import { ModelValidator, ValidationResult } from '../core/validation/ModelValidator';
import { StorageService } from './storage.service';
import { Model } from '../models/Model';
import { GModelFactory } from '../core/GModelFactory';
import { GModelOperations } from '../core/GModelOperations';
import { GModelMutations, PatchDataType, PatchNode, PatchRelation } from '../core/GModelMutations';

export type CreateSlotInput = {
  uri: string;
  name: string;
  version: string;
  description: string;
};

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly storage: StorageService = inject(StorageService);
  private readonly suggest: SuggestionHelper = new SuggestionHelper();
  private readonly validator: ModelValidator = new ModelValidator();

  public readonly selectedNodeId: WritableSignal<Id | null> = signal(null);
  public readonly selectedSlot: WritableSignal<number> = signal(1);
  public readonly workingModel: WritableSignal<GModel | null> = signal(null);

  private readonly baseSlot: Signal<number> = computed((): number =>
    Math.max(0, this.selectedSlot() - 1),
  );

  public readonly baseModel: Signal<GModel | null> = computed((): GModel | null => {
    const work: Model | undefined = this.storage.modelsBySlot().get(this.baseSlot());
    return work?.gmodel ?? null;
  });

  public readonly slotModel: Signal<GModel | null> = computed((): GModel | null => {
    const work: Model | undefined = this.storage.modelsBySlot().get(this.selectedSlot());
    return work?.gmodel ?? null;
  });

  public readonly baseId: Signal<Id> = computed((): Id => this.baseModel()?.id ?? '');

  public readonly validation: Signal<ValidationResult> = computed((): ValidationResult => {
    const base: GModel | null = this.baseModel();
    const work: GModel | null = this.workingModel();
    if (!base || !work) return { diagnostics: [], hasErrors: false };
    return this.validator.validate(base, work);
  });

  public readonly baseNodes: Signal<GNode[]> = computed((): GNode[] => {
    const base: GModel | null = this.baseModel();
    return base ? Array.from(this.suggest.listNodes(base)) : [];
  });

  public readonly workNodes: Signal<GNode[]> = computed((): GNode[] => {
    const work: GModel | null = this.workingModel();
    return work ? Array.from(this.suggest.listNodes(work)) : [];
  });

  public readonly workNodesByBaseId: Signal<ReadonlyMap<Id, ReadonlyArray<GNode>>> = computed(
    (): ReadonlyMap<Id, ReadonlyArray<GNode>> => {
      const base: GModel | null = this.baseModel();
      const work: GModel | null = this.workingModel();
      if (!base || !work) return new Map<Id, ReadonlyArray<GNode>>();

      return this.suggest.groupDerivedNodesByBaseId(base, work);
    },
  );

  public readonly baseRelations: Signal<GRelation[]> = computed((): GRelation[] => {
    const base: GModel | null = this.baseModel();
    return base ? Array.from(this.suggest.listRelations(base)) : [];
  });

  public readonly dataTypes: Signal<GDataType[]> = computed((): GDataType[] => {
    const base: GModel | null = this.baseModel();
    const work: GModel | null = this.workingModel();
    if (!base || !work) return [];
    return Array.from(this.suggest.listAllDataTypes(base, work));
  });

  public readonly workTypes: Signal<GDataType[]> = computed((): GDataType[] => {
    const work: GModel | null = this.workingModel();
    return work ? Array.from(this.suggest.listDataTypes(work)) : [];
  });

  constructor() {
    effect((): void => {
      const modelsBySlot: Map<number, Model> = this.storage.modelsBySlot();
      if (modelsBySlot.size === 0) return;

      const slot: number = this.selectedSlot();
      if (!modelsBySlot.has(slot)) this.setSelectedSlot(1);
    });

    effect((): void => {
      const slotModel: GModel | null = this.slotModel();
      this.workingModel.set(slotModel ? structuredClone(slotModel) : null);
    });
  }

  public setSelectedNodeId(nodeId: Id | null): void {
    this.selectedNodeId.set(nodeId);
  }

  public setSelectedSlot(slot: number): void {
    this.selectedSlot.set(Math.max(1, slot));
  }

  public resetSelections(): void {
    this.setSelectedNodeId(null);
    this.setSelectedSlot(1);
  }

  public resetWork(): void {
    const slotModel: GModel | null = this.slotModel();
    this.workingModel.set(slotModel ? structuredClone(slotModel) : null);
  }

  public async createNode(name: string, baseNodeId: Id): Promise<GNode> {
    const node: GNode = this.suggest.createDerivedNode(this.baseId(), { name, baseNodeId });
    this.apply((w: GModel): GModel => GModelMutations.addClassifier(w, node));
    await this.saveWorkToSelectedSlot();
    return node;
  }

  public async duplicateNode(sourceNodeId: Id): Promise<GNode> {
    const work: GModel | null = this.workingModel();
    if (!work) throw new Error('No work loaded.');

    const source: GNode | undefined = work.classifiers.find(
      (c: GClassifier): c is GNode => c.kind === 'GNode' && c.id === sourceNodeId,
    );
    if (!source) throw new Error(`Node not found: ${sourceNodeId}`);
    const cloned: GNode = this.suggest.duplicateDerivedNode(source);

    this.apply((w: GModel): GModel => GModelMutations.addClassifier(w, cloned));
    await this.saveWorkToSelectedSlot();
    return cloned;
  }

  public async deleteNode(nodeId: Id): Promise<void> {
    this.apply((w: GModel): GModel => GModelOperations.deleteNode(w, nodeId));
    await this.saveWorkToSelectedSlot();

    if (this.selectedNodeId() === nodeId) {
      this.selectedNodeId.set('');
    }
  }

  public async updateNode(nodeId: Id, patch: PatchNode): Promise<void> {
    this.apply((w: GModel): GModel => GModelMutations.updateNode(w, nodeId, patch));
    await this.saveWorkToSelectedSlot();
  }

  public async createDataType(name: string): Promise<GDataType> {
    const dataType: GDataType = this.suggest.createDataType({ name });
    this.apply((w: GModel): GModel => GModelMutations.addClassifier(w, dataType));
    await this.saveWorkToSelectedSlot();
    return dataType;
  }

  public async deleteDataType(dataTypeId: Id): Promise<void> {
    this.apply((w: GModel): GModel => GModelOperations.deleteDataType(w, dataTypeId));
    await this.saveWorkToSelectedSlot();
  }

  public async updateDataType(dataTypeId: Id, patch: PatchDataType): Promise<void> {
    this.apply((w: GModel): GModel => GModelMutations.updateDataType(w, dataTypeId, patch));
    await this.saveWorkToSelectedSlot();
  }

  public async createRelation(
    baseRelationId: Id,
    fromNodeId: Id,
    toNodeId: Id,
  ): Promise<GRelation> {
    const base: GModel | null = this.baseModel();
    if (!base) throw new Error('No base loaded.');

    const relation: GRelation = this.suggest.createDerivedRelation(base, base.id, {
      baseRelationId,
      fromNodeId,
      toNodeId,
    });

    this.apply((w: GModel): GModel => GModelMutations.addRelation(w, relation));
    await this.saveWorkToSelectedSlot();
    return relation;
  }

  public async updateRelation(relationId: Id, patch: PatchRelation): Promise<void> {
    this.apply((w: GModel): GModel => GModelMutations.updateRelation(w, relationId, patch));
    await this.saveWorkToSelectedSlot();
  }

  public async deleteRelation(relationId: Id): Promise<void> {
    this.apply((w: GModel): GModel => GModelMutations.removeRelationById(w, relationId));
    await this.saveWorkToSelectedSlot();
  }

  private apply(mutator: (work: GModel) => GModel): void {
    const current: GModel | null = this.workingModel();
    if (!current) throw new Error('No work loaded.');

    const updated: GModel = mutator(current);
    this.workingModel.set(updated);
  }

  public listFromRelations(fromNodeId: Id): GRelation[] {
    const base: GModel | null = this.baseModel();
    const work: GModel | null = this.workingModel();
    if (!base || !work) return [];
    return Array.from(this.suggest.listFromRelations(base, work, fromNodeId));
  }

  public listToNodes(baseRelationId: Id): GNode[] {
    const base: GModel | null = this.baseModel();
    const work: GModel | null = this.workingModel();
    if (!base || !work) return [];
    return Array.from(this.suggest.listToNodes(base, work, baseRelationId));
  }

  public listForbiddenAttributes(nodeId: Id): Set<string> {
    const base: GModel | null = this.baseModel();
    const work: GModel | null = this.workingModel();
    if (!base || !work) return new Set<string>();
    return new Set(this.suggest.listForbiddenAttributes(base, work, nodeId));
  }

  public filteredWorkNodes(baseNodeId: Id): ReadonlyArray<GNode> {
    return this.workNodesByBaseId().get(baseNodeId) ?? [];
  }

  public async updateModelMeta(patch: Pick<CreateSlotInput, 'name' | 'version'>): Promise<void> {
    this.apply((work: GModel) => ({
      ...work,
      name: patch.name ?? work.name,
      version: patch.version ?? work.version,
    }));
    await this.saveWorkToSelectedSlot();
  }

  public async createModel(input: CreateSlotInput): Promise<void> {
    const pid: string | null = this.storage.selectedProjectId();
    if (!pid) throw new Error('No active project selected.');

    const slot: number = await this.storage.getLastSlot(pid);
    const base: GModel | null = this.storage.modelsBySlot().get(slot)?.gmodel ?? null;
    if (!base) throw new Error(`Base model missing for slot ${slot}.`);

    const gmodel: GModel = GModelFactory.deriveModel(base, {
      schemaId: input.uri,
      id: SuggestionHelper.createIdentifier(),
      name: input.name,
      version: input.version,
    });

    await this.storage.createModel({
      projectId: pid,
      gmodel,
      name: input.name,
      description: input.description,
    });

    this.setSelectedSlot(slot + 1);
  }

  public async saveWorkToSelectedSlot(): Promise<void> {
    const pid: string | null = this.storage.selectedProjectId();
    const slot: number = this.selectedSlot();
    const work: GModel | null = this.workingModel();
    const row: Model | undefined = this.storage.modelsBySlot().get(slot);

    if (!pid || !work || !row) throw new Error('Cannot save (missing state).');

    await this.storage.updateModel(row.modelId, {
      gmodel: work,
      name: row.name,
      description: row.description,
    });
  }
}
