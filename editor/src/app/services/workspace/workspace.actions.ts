import { effect, inject, Injectable } from '@angular/core';
import { StorageService, UpdateRecordInput } from '../storage.service';
import { WorkspaceStore } from './workspace.store';
import { WorkspaceView } from './workspace.view';
import { ModelRecord, NodeColors, ViewSettings } from '../../models/ModelRecord';
import { GAttribute, GDataType, GModel, GNode, GRelation, Id } from '../../core/models/GModel';
import {
  GModelMutations,
  UpdateAttributeInput,
  UpdateDataTypeInput,
  UpdateNodeInput,
  UpdateRelationInput,
} from '../../core/GModelMutations';
import {
  ConnectedNode,
  CreateAttributeInput,
  CreateDataTypeInput,
  CreateNodeInput,
  CreateRelationInput,
  GModelFactory,
} from '../../core/GModelFactory';

export type UpdateSlotInput = CreateSlotInput;
export type CreateSlotInput = {
  uri: string;
  name: string;
  version: string;
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
      const slot: number | null = this.store.currentSlot();
      const record: ModelRecord | undefined = this.storage.recordsBySlot().get(slot);
      const model: GModel | null = record ? structuredClone(record.gmodel) : null;
      this.store.setCurrentModel(model);
      this.store.setCurrentModelRecord(record ?? null);
    });
  }

  private registerNodeColorsEffect(): void {
    effect((): void => {
      const slot: number = this.store.currentSlot();
      const record: ModelRecord | undefined = this.storage.recordsBySlot().get(slot);
      const map: NodeColors = record?.view?.nodeColors ?? {};
      this.store.setCurrentNodeColors(map);
    });
  }

  public apply(mutator: (model: GModel) => GModel): void {
    const current: GModel | null = this.store.currentModel();
    if (!current) throw new Error('Cannot apply: no working model loaded.');

    const updated: GModel = mutator(current);
    this.store.setCurrentModel(updated);
  }

  public async createNode(input: CreateNodeInput): Promise<GNode> {
    const baseId: Id = this.view.baseId();
    const node: GNode = GModelFactory.createNode(baseId, input);
    this.apply((model: GModel): GModel => GModelMutations.addClassifier(model, node));
    await this.saveCurrentModel();

    return node;
  }

  public async updateNode(nodeId: Id, patch: UpdateNodeInput): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.updateNode(model, nodeId, patch));
    await this.saveCurrentModel();
  }

  public async removeNode(nodeId: Id): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.removeNode(model, nodeId));
    await this.saveCurrentModel();
  }

  public async duplicateNode(nodeId: Id): Promise<GNode> {
    const model: GModel | null = this.store.currentModel();
    if (!model) throw new Error('Cannot duplicate: no working model loaded.');
    const cloned: ConnectedNode = GModelFactory.duplicateConnectedNode(model, nodeId);

    this.apply((model: GModel): GModel => {
      let updated: GModel = GModelMutations.addClassifier(model, cloned.node);
      for (const relation of cloned.relations) {
        updated = GModelMutations.addRelation(updated, relation);
      }
      return updated;
    });

    await this.saveCurrentModel();
    return cloned.node;
  }

  public async createAttribute(nodeId: Id, input: CreateAttributeInput): Promise<void> {
    const modelsById: ReadonlyMap<Id, GModel> = this.storage.modelsById();
    const attribute: GAttribute = GModelFactory.createAttribute(input);
    this.apply((model: GModel): GModel => GModelMutations.addAttribute(model, nodeId, attribute, modelsById));
    await this.saveCurrentModel();
  }

  public async updateAttribute(nodeId: Id, name: string, patch: UpdateAttributeInput): Promise<void> {
    const modelsById: ReadonlyMap<Id, GModel> = this.storage.modelsById();
    this.apply((model: GModel): GModel => GModelMutations.updateAttribute(model, nodeId, name, patch, modelsById));
    await this.saveCurrentModel();
  }

  public async removeAttribute(nodeId: Id, name: string): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.removeAttribute(model, nodeId, name));
    await this.saveCurrentModel();
  }

  public async createDataType(input: CreateDataTypeInput): Promise<GDataType> {
    const dataType: GDataType = GModelFactory.createDataType(input);
    this.apply((model: GModel): GModel => GModelMutations.addClassifier(model, dataType));
    await this.saveCurrentModel();
    return dataType;
  }

  public async updateDataType(dataTypeId: Id, patch: UpdateDataTypeInput): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.updateDataType(model, dataTypeId, patch));
    await this.saveCurrentModel();
  }

  public async createRelation(input: CreateRelationInput): Promise<GRelation> {
    const base: GModel | null = this.view.baseModel();
    if (!base) throw new Error('Cannot create relation: no base model loaded.');

    const relation: GRelation = GModelFactory.createRelation(base, base.id, input);
    this.apply((model: GModel): GModel => GModelMutations.addRelation(model, relation));
    await this.saveCurrentModel();
    return relation;
  }

  public async updateRelation(relationId: Id, patch: UpdateRelationInput): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.updateRelation(model, relationId, patch));
    await this.saveCurrentModel();
  }

  public async removeRelation(relationId: Id): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.removeRelationById(model, relationId));
    await this.saveCurrentModel();
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

    await this.storage.createRecord({ projectId: projectId, gmodel: derived, name: input.name });
    return lastSlot + 1;
  }

  public async updateSlot(slot: number, patch: UpdateSlotInput): Promise<void> {
    const existing: ModelRecord | undefined = this.storage.recordsBySlot().get(slot);
    if (!existing) throw new Error(`Cannot update: model in ${slot} does not exist.`);
    const { name, version, uri } = patch;

    const updatedModel: GModel = {
      ...existing.gmodel,
      name: name ?? existing.gmodel.name,
      version: version ?? existing.gmodel.version,
      $id: uri ?? existing.gmodel.$id,
    };

    const recordPatch: UpdateRecordInput = { name: name ?? existing.name, gmodel: updatedModel };
    await this.storage.updateRecord(existing.modelId, recordPatch);
  }

  public async removeSlot(slot: number): Promise<void> {
    const projectId: string | null = this.storage.selectedProjectId();
    if (!projectId) throw new Error('Cannot remove: no active project selected.');
    await this.storage.removeSlot(projectId, slot);
  }

  public async updateNodeColors(): Promise<void> {
    const nodeColors: NodeColors = this.store.currentNodeColors();
    await this.saveSelectedViewSettings({ nodeColors });
  }

  public async saveCurrentModel(): Promise<void> {
    const model: GModel | null = this.store.currentModel();
    if (!model) throw new Error('Cannot save: no working model loaded.');

    const existing: ModelRecord = this.getSelectedRecord();
    const patch: Partial<UpdateRecordInput> = { gmodel: model, name: existing.name };

    await this.storage.updateRecord(existing.modelId, patch);
  }

  private async saveSelectedViewSettings(view: Partial<ViewSettings>): Promise<void> {
    const existing: ModelRecord = this.getSelectedRecord();
    const currentView: ViewSettings = existing.view ?? { nodeColors: {} };
    await this.storage.updateRecord(existing.modelId, { view: { ...currentView, ...view } });
  }

  private getSelectedRecord(): ModelRecord {
    const selectedSlot: number = this.store.currentSlot();
    const existing: ModelRecord | undefined = this.storage.recordsBySlot().get(selectedSlot);
    if (!existing) throw new Error(`Cannot persist: no model for slot ${selectedSlot}.`);

    return existing;
  }
}
