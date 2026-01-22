import { effect, inject, Injectable } from '@angular/core';
import { StorageService, UpdateRecordInput } from '../storage.service';
import { WorkspaceStore } from './workspace.store';
import { WorkspaceQueries } from './workspace.queries';
import {
  ConnectedNode,
  CreateNodeInput,
  CreateRelationInput,
  SuggestionHelper,
} from '../../core/helper/SuggestionHelper';
import { ModelRecord, NodeColors, ViewSettings } from '../../models/ModelRecord';
import { GDataType, GModel, GNode, GRelation, Id } from '../../core/models/GModel';
import { GModelMutations, PatchDataType, PatchNode, PatchRelation } from '../../core/handler/GModelMutations';
import { GModelOperations } from '../../core/handler/GModelOperations';
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
  private readonly view: WorkspaceQueries = inject(WorkspaceQueries);

  private readonly helper: SuggestionHelper = new SuggestionHelper();

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
      const selectedSlot: number | null = this.store.selectedSlot();
      if (selectedSlot === null) return this.store.setSelectedNodeColors({});

      const record: ModelRecord | undefined = this.storage.recordsBySlot().get(selectedSlot);
      const nodeColors: NodeColors = record?.view?.nodeColors ?? {};
      this.store.setSelectedNodeColors(nodeColors);
    });
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

    this.apply((model: GModel): GModel => GModelMutations.addClassifier(model, node));
    await this.saveSelectedWork();

    return node;
  }

  public async duplicateNode(nodeId: Id): Promise<GNode> {
    const work: GModel | null = this.store.workingModel();
    if (!work) throw new Error('No working model loaded.');

    const cloned: ConnectedNode = this.helper.duplicateConnectedNode(work, nodeId);

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
    this.apply((model: GModel): GModel => GModelOperations.deleteNode(model, nodeId));
    await this.saveSelectedWork();
  }

  public async updateNode(nodeId: Id, patch: PatchNode): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.updateNode(model, nodeId, patch));
    await this.saveSelectedWork();
  }

  public async createDataType(dataTypeName: string): Promise<GDataType> {
    const dataType: GDataType = this.helper.createDataType({ name: dataTypeName });
    this.apply((model: GModel): GModel => GModelMutations.addClassifier(model, dataType));
    await this.saveSelectedWork();

    return dataType;
  }

  public async deleteDataType(dataTypeId: Id): Promise<void> {
    this.apply((model: GModel): GModel => GModelOperations.deleteDataType(model, dataTypeId));
    await this.saveSelectedWork();
  }

  public async updateDataType(dataTypeId: Id, patch: PatchDataType): Promise<void> {
    this.apply((model: GModel): GModel => GModelMutations.updateDataType(model, dataTypeId, patch));
    await this.saveSelectedWork();
  }

  public async createRelation(baseRelationId: Id, fromNodeId: Id, toNodeId: Id): Promise<GRelation> {
    const base: GModel | null = this.view.baseModel();
    if (!base) throw new Error('No base model loaded.');

    const input: CreateRelationInput = { baseRelationId, fromNodeId, toNodeId };
    const relation: GRelation = this.helper.createDerivedRelation(base, base.id, input);

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
    if (!projectId) throw new Error('No active project selected.');

    const lastSlot: number = await this.storage.getLastSlot(projectId);
    const base: GModel | null = this.storage.recordsBySlot().get(lastSlot)?.gmodel ?? null;
    if (!base) throw new Error(`Base model missing for slot ${lastSlot}.`);

    const derived: GModel = GModelFactory.deriveModel(base, {
      schemaId: input.uri,
      id: SuggestionHelper.createIdentifier(),
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

  public async deleteSlot(slot: number): Promise<void> {
    const projectId: string | null = this.storage.selectedProjectId();
    if (!projectId) throw new Error('No active project selected.');
    await this.storage.deleteSlot(projectId, slot);
  }

  public async updateModelInformation(name: string | null, version: string | null): Promise<void> {
    this.apply((model: GModel): GModel => {
      const modelName: string = name ?? model.name;
      const modelVersion: string = version ?? model.version;
      return { ...model, name: modelName, version: modelVersion };
    });
    await this.saveSelectedWork();
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
    const selectedSlot: number | null = this.store.selectedSlot();
    if (selectedSlot === null) throw new Error('Cannot persist: no selected slot to persist.');

    const existing: ModelRecord | undefined = this.storage.recordsBySlot().get(selectedSlot);
    if (!existing) throw new Error(`Cannot persist: no model for slot ${selectedSlot}.`);

    return existing;
  }
}
