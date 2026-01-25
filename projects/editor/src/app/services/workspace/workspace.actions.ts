import { effect, inject, Injectable } from '@angular/core';
import { StorageService, UpdateRecordInput } from '../storage.service';
import { WorkspaceStore } from './workspace.store';
import { WorkspaceView } from './workspace.view';
import { ModelRecord, NodeColors, ViewSettings } from '../../models/ModelRecord';
import { GDataType, GModel, GNode, GRelation, Id } from '../../core/models/GModel';
import { GModelMutations, PatchDataType, PatchNode, PatchRelation } from '../../core/GModelMutations';
import { ConnectedNode, CreateNodeInput, CreateRelationInput, GModelFactory } from '../../core/GModelFactory';

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

  constructor() {
    this.registerSlotChangesEffect();
    this.registerNodeColorsEffect();
  }

  private registerSlotChangesEffect(): void {
    effect((): void => {
      const derived: GModel | null = this.view.slotModel();
      const work: GModel | null = derived ? structuredClone(derived) : null;
      this.store.setWorkingModel(work);
    });
  }

  private registerNodeColorsEffect(): void {
    effect((): void => {
      const selectedSlot: number = this.store.selectedSlot();
      const record: ModelRecord | undefined = this.storage.recordsBySlot().get(selectedSlot);
      const nodeColors: NodeColors = record?.view?.nodeColors ?? {};
      this.store.setSelectedNodeColors(nodeColors);
    });
  }

  public apply(mutator: (workingModel: GModel) => GModel): void {
    const current: GModel | null = this.store.workingModel();
    if (!current) throw new Error('Cannot apply: no working model loaded.');

    const updated: GModel = mutator(current);
    this.store.setWorkingModel(updated);
  }

  public async createNode(nodeName: string, baseNodeId: Id): Promise<GNode> {
    const baseId: Id = this.view.baseId();
    const input: CreateNodeInput = { name: nodeName, baseNodeId };
    const node: GNode = GModelFactory.createNode(baseId, input);

    this.apply((model: GModel): GModel => GModelMutations.addClassifier(model, node));
    await this.saveSelectedWork();

    return node;
  }

  public async duplicateNode(nodeId: Id): Promise<GNode> {
    const work: GModel | null = this.store.workingModel();
    if (!work) throw new Error('Cannot duplicate: no working model loaded.');

    const cloned: ConnectedNode = GModelFactory.duplicateConnectedNode(work, nodeId);

    this.apply((model: GModel): GModel => {
      let updated: GModel = GModelMutations.addClassifier(model, cloned.node);
      for (const relation of cloned.relations) {
        updated = GModelMutations.addRelation(updated, relation);
      }
      return updated;
    });

    await this.saveSelectedWork();
    return cloned.node;
  }

  public async deleteNode(nodeId: Id): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.deleteNode(model, nodeId));
    await this.saveSelectedWork();
  }

  public async updateNode(nodeId: Id, patch: PatchNode): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.updateNode(model, nodeId, patch));
    await this.saveSelectedWork();
  }

  public async createDataType(dataTypeName: string): Promise<GDataType> {
    const dataType: GDataType = GModelFactory.createDataType({ name: dataTypeName });
    this.apply((model: GModel): GModel => GModelMutations.addClassifier(model, dataType));
    await this.saveSelectedWork();

    return dataType;
  }

  public async deleteDataType(dataTypeId: Id): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.deleteDataType(model, dataTypeId));
    await this.saveSelectedWork();
  }

  public async updateDataType(dataTypeId: Id, patch: PatchDataType): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.updateDataType(model, dataTypeId, patch));
    await this.saveSelectedWork();
  }

  public async createRelation(baseRelationId: Id, fromNodeId: Id, toNodeId: Id): Promise<GRelation> {
    const base: GModel | null = this.view.baseModel();
    if (!base) throw new Error('Cannot create relation: no base model loaded.');

    const input: CreateRelationInput = { baseRelationId, fromNodeId, toNodeId };
    const relation: GRelation = GModelFactory.createRelation(base, base.id, input);

    this.apply((model: GModel): GModel => GModelMutations.addRelation(model, relation));
    await this.saveSelectedWork();
    return relation;
  }

  public async updateRelation(relationId: Id, patch: PatchRelation): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.updateRelation(model, relationId, patch));
    await this.saveSelectedWork();
  }

  public async deleteRelation(relationId: Id): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.removeRelationById(model, relationId));
    await this.saveSelectedWork();
  }

  public async createSlot(input: CreateSlotInput): Promise<number> {
    const projectId: string | null = this.storage.selectedProjectId();
    if (!projectId) throw new Error('Cannot create slot: no active project selected.');

    const lastSlot: number = await this.storage.getLastSlot(projectId);
    const base: GModel | null = this.storage.recordsBySlot().get(lastSlot)?.gmodel ?? null;
    if (!base) throw new Error(`Cannot create slot: base model missing for slot ${lastSlot}.`);

    const derived: GModel = GModelFactory.createModel(base, {
      uri: input.uri,
      id: GModelFactory.createIdentifier(),
      name: input.name,
      version: input.version,
    });

    await this.storage.createRecord({
      projectId: projectId,
      gmodel: derived,
      name: input.name,
      description: input.description,
    });

    return lastSlot + 1;
  }

  public async updateSlot(slot: number, input: CreateSlotInput): Promise<void> {
    const existing: ModelRecord | undefined = this.storage.recordsBySlot().get(slot);
    if (!existing) throw new Error(`Cannot update: model in ${slot} does not exist.`);
    const { name, description, version, uri } = input;

    const updatedModel: GModel = {
      ...existing.gmodel,
      name: name ?? existing.gmodel.name,
      version: version ?? existing.gmodel.version,
      $id: uri ?? existing.gmodel.$id,
    };

    const patch: UpdateRecordInput = {
      name: name ?? existing.name,
      description: description ?? existing.description,
      gmodel: updatedModel,
    };

    await this.storage.updateRecord(existing.modelId, patch);
  }

  public async deleteSlot(slot: number): Promise<void> {
    const projectId: string | null = this.storage.selectedProjectId();
    if (!projectId) throw new Error('Cannot delete: no active project selected.');
    await this.storage.deleteSlot(projectId, slot);
  }

  public async updateNodeColors(): Promise<void> {
    const nodeColors: NodeColors = this.store.selectedNodeColors();
    await this.saveSelectedViewSettings({ nodeColors });
  }

  public async saveSelectedWork(): Promise<void> {
    const work: GModel | null = this.store.workingModel();
    if (!work) throw new Error('Cannot save: no working model loaded.');

    const existing: ModelRecord = this.getSelectedRecord();
    const patch: Partial<UpdateRecordInput> = {
      gmodel: work,
      name: existing.name,
      description: existing.description,
    };

    await this.storage.updateRecord(existing.modelId, patch);
  }

  private async saveSelectedViewSettings(view: Partial<ViewSettings>): Promise<void> {
    const existing: ModelRecord = this.getSelectedRecord();
    const currentView: ViewSettings = existing.view ?? { nodeColors: {} };
    await this.storage.updateRecord(existing.modelId, { view: { ...currentView, ...view } });
  }

  private getSelectedRecord(): ModelRecord {
    const selectedSlot: number = this.store.selectedSlot();
    const existing: ModelRecord | undefined = this.storage.recordsBySlot().get(selectedSlot);
    if (!existing) throw new Error(`Cannot persist: no model for slot ${selectedSlot}.`);

    return existing;
  }
}
