import { effect, inject, Injectable } from '@angular/core';
import { StorageService } from '../storage.service';
import { WorkspaceStore } from './workspace.store';
import { WorkspaceView } from './workspace.view';
import { CreateNodeInput, SuggestionHelper } from '../../core/validation/helper/SuggestionHelper';
import { Model } from '../../models/Model';
import { GClassifier, GDataType, GModel, GNode, GRelation, Id } from '../../core/models/GModel';
import {
  GModelMutations,
  PatchDataType,
  PatchNode,
  PatchRelation,
} from '../../core/GModelMutations';
import { GModelOperations } from '../../core/GModelOperations';
import { GModelFactory } from '../../core/GModelFactory';

export type CreateSlotInput = {
  uri: string;
  name: string;
  version: string;
  description: string;
};

@Injectable({ providedIn: 'root' })
export class WorkspaceActions {
  private readonly storage: StorageService = inject(StorageService);
  private readonly store: WorkspaceStore = inject(WorkspaceStore);
  private readonly view: WorkspaceView = inject(WorkspaceView);

  private readonly helper: SuggestionHelper = new SuggestionHelper();

  constructor() {
    effect((): void => {
      const models: Map<number, Model> = this.storage.modelsBySlot();
      if (models.size === 0) return;

      const slot: number = this.store.selectedSlot();
      if (!models.has(slot)) this.store.setSelectedSlot(1);
    });

    effect((): void => {
      const model: GModel | null = this.view.slotModel();
      const work: GModel | null = model ? structuredClone(model) : null;
      this.store.setWorkingModel(work);
    });
  }

  public resetCurrentWork(): void {
    const slot: GModel | null = this.view.slotModel();
    const work: GModel | null = slot ? structuredClone(slot) : null;
    this.store.setWorkingModel(work);
  }

  public apply(mutator: (workingModel: GModel) => GModel): void {
    const current: GModel | null = this.store.workingModel();
    if (!current) throw new Error('No working model loaded.');

    const updated: GModel = mutator(current);
    this.store.setWorkingModel(updated);
  }

  public async createNode(nodeName: string, baseNodeId: Id): Promise<GNode> {
    const baseId: Id = this.view.baseId();
    const input: CreateNodeInput = { name: nodeName, baseNodeId };
    const node: GNode = this.helper.createDerivedNode(baseId, input);

    this.apply((w: GModel): GModel => GModelMutations.addClassifier(w, node));
    await this.saveWorkToSelectedSlot();

    return node;
  }

  public async duplicateNode(sourceNodeId: Id): Promise<GNode> {
    const work: GModel | null = this.store.workingModel();
    if (!work) throw new Error('No working model loaded.');

    const source: GNode | undefined = work.classifiers.find(
      (classifier: GClassifier): classifier is GNode =>
        classifier.kind === 'GNode' && classifier.id === sourceNodeId,
    );
    if (!source) throw new Error(`Node not found: ${sourceNodeId}`);

    const cloned: GNode = this.helper.duplicateDerivedNode(source);
    this.apply((w: GModel): GModel => GModelMutations.addClassifier(w, cloned));
    await this.saveWorkToSelectedSlot();

    return cloned;
  }

  public async deleteNode(nodeId: Id): Promise<void> {
    this.apply((w: GModel): GModel => GModelOperations.deleteNode(w, nodeId));
    await this.saveWorkToSelectedSlot();

    if (this.store.selectedNodeId() === nodeId) {
      this.store.setSelectedNodeId(null);
    }
  }

  public async updateNode(nodeId: Id, patch: PatchNode): Promise<void> {
    this.apply((w: GModel): GModel => GModelMutations.updateNode(w, nodeId, patch));
    await this.saveWorkToSelectedSlot();
  }

  public async createDataType(dataTypeName: string): Promise<GDataType> {
    const dataType: GDataType = this.helper.createDataType({ name: dataTypeName });
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
    const base: GModel | null = this.view.baseModel();
    if (!base) throw new Error('No base model loaded.');

    const relation: GRelation = this.helper.createDerivedRelation(base, base.id, {
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

  public async updateModelMeta(
    modelName: string | null,
    modelVersion: string | null,
  ): Promise<void> {
    this.apply(
      (currentModel: GModel): GModel => ({
        ...currentModel,
        name: modelName ?? currentModel.name,
        version: modelVersion ?? currentModel.version,
      }),
    );

    await this.saveWorkToSelectedSlot();
  }

  public async createModel(input: CreateSlotInput): Promise<void> {
    const projectId: string | null = this.storage.selectedProjectId();
    if (!projectId) throw new Error('No active project selected.');

    const lastSlot: number = await this.storage.getLastSlot(projectId);
    const base: GModel | null = this.storage.modelsBySlot().get(lastSlot)?.gmodel ?? null;
    if (!base) throw new Error(`Base model missing for slot ${lastSlot}.`);

    const derived: GModel = GModelFactory.deriveModel(base, {
      schemaId: input.uri,
      id: SuggestionHelper.createIdentifier(),
      name: input.name,
      version: input.version,
    });

    await this.storage.createModel({
      projectId: projectId,
      gmodel: derived,
      name: input.name,
      description: input.description,
    });

    this.store.setSelectedSlot(lastSlot + 1);
  }

  public async saveWorkToSelectedSlot(): Promise<void> {
    const projectId: string | null = this.storage.selectedProjectId();
    const selectedSlot: number = this.store.selectedSlot();
    const work: GModel | null = this.store.workingModel();

    const existing: Model | undefined = this.storage.modelsBySlot().get(selectedSlot);
    if (!projectId || !work || !existing) {
      throw new Error('Cannot save (missing state).');
    }

    await this.storage.updateModel(existing.modelId, {
      gmodel: work,
      name: existing.name,
      description: existing.description,
    });
  }
}
