import { inject, Injectable } from '@angular/core';
import {
  type AttributeInput,
  type CreateNodeInput,
  type Node,
  type Model,
  type Relation,
  type RelationInput,
  type DataType,
  type CreateDataTypeInput,
  type UpdateNodeInput,
  type UpdateAttributeInput,
  type UpdateDataTypeInput,
  type UpdateRelationInput,
  type ModelInput,
  type ModelChange,
  type NodeRemovalPreview,
  type RelationRemovalPreview,
  type ModelRemovalPreview,
} from '@ramen-suite/core/model';
import { type RamenModel } from '@ramen-suite/core/ramen';
import { StorageService } from '../storage.service';
import { WorkspaceStore } from './workspace.store';
import { type ModelRecord, type ViewSettings } from '../../models/ModelRecord';

export type CreateSlotInput = Required<Pick<ModelInput, 'name' | 'uri' | 'version'>>;
export type UpdateSlotInput = CreateSlotInput;

@Injectable({ providedIn: 'root' })
export class WorkspaceActions {
  private readonly storage: StorageService = inject(StorageService);
  private readonly store: WorkspaceStore = inject(WorkspaceStore);
  private pendingSave: Promise<void> = Promise.resolve();

  public async createNode(input: CreateNodeInput): Promise<Node> {
    const change: ModelChange<Node> = this.store.getDraft().createNode({ name: input.name, refines: input.baseNodeId });
    await this.saveCurrentModel();
    return change.element;
  }

  public async updateNode(nodeId: string, patch: UpdateNodeInput): Promise<void> {
    this.store.getDraft().updateNode(nodeId, patch);
    await this.saveCurrentModel();
  }

  public previewNodeRemoval(nodeId: string): NodeRemovalPreview {
    return this.store.getDraft().previewNodeRemoval(nodeId);
  }

  public async removeNode(nodeId: string, cascade: boolean = false): Promise<void> {
    this.store.getDraft().removeNode(nodeId, { cascade });
    await this.saveCurrentModel();
  }

  public async duplicateNode(nodeId: string): Promise<Node> {
    const draft: RamenModel = this.store.getDraft();
    const node: Node | undefined = draft.getNode(nodeId);
    if (!node) throw new Error('The selected node no longer exists.');
    const copy: Node = draft.createNode({
      name: `${node.name}Copy`,
      refines: node.superTypes[0],
      constraints: node.constraints,
    }).element;
    for (const attribute of node.attributes) {
      const { id: _id, ...input } = attribute;
      draft.createAttribute(copy, input);
    }
    this.duplicateRelations(draft, node, copy);
    await this.saveCurrentModel();
    return copy;
  }

  public async createAttribute(nodeId: string, input: AttributeInput): Promise<void> {
    this.store.getDraft().createAttribute(nodeId, input);
    await this.saveCurrentModel();
  }

  public async updateAttribute(nodeId: string, attributeId: string, patch: UpdateAttributeInput): Promise<void> {
    this.store.getDraft().updateAttribute(nodeId, attributeId, patch);
    await this.saveCurrentModel();
  }

  public async removeAttribute(nodeId: string, attributeId: string): Promise<void> {
    this.store.getDraft().removeAttribute(nodeId, attributeId);
    await this.saveCurrentModel();
  }

  public async createDataType(input: CreateDataTypeInput): Promise<DataType> {
    const type: DataType = this.store.getDraft().createDataType(input).element;
    await this.saveCurrentModel();
    return type;
  }

  public async updateDataType(id: string, patch: UpdateDataTypeInput): Promise<void> {
    this.store.getDraft().updateDataType(id, patch);
    await this.saveCurrentModel();
  }

  public async createRelation(input: RelationInput): Promise<Relation> {
    const relation: Relation = this.store.getDraft().createRelation(input).element;
    await this.saveCurrentModel();
    return relation;
  }

  public async updateRelation(id: string, patch: UpdateRelationInput): Promise<void> {
    this.store.getDraft().updateRelation(id, patch);
    await this.saveCurrentModel();
  }

  public previewRelationRemoval(id: string): RelationRemovalPreview {
    return this.store.getDraft().previewRelationRemoval(id);
  }

  public async removeRelation(id: string, cascade: boolean = false): Promise<void> {
    this.store.getDraft().removeRelation(id, { cascade });
    await this.saveCurrentModel();
  }

  public async createSlot(input: CreateSlotInput): Promise<number> {
    const next: RamenModel = this.store.getDraft().createNextLevel(input);
    this.store.addLevel(next);
    await this.saveCurrentModel();
    return this.storage.records().find((record: ModelRecord): boolean => record.gmodel.id === next.getModel().id)?.slot ?? 1;
  }

  public async updateSlot(slot: number, input: UpdateSlotInput): Promise<void> {
    const record: ModelRecord | undefined = this.storage.recordsBySlot().get(slot);
    if (!record) throw new Error('The selected model no longer exists.');
    this.store.getWorkspace().openLevel(record.gmodel.id).updateModel(input);
    await this.saveCurrentModel();
  }

  public previewSlotRemoval(slot: number): ModelRemovalPreview {
    const record: ModelRecord | undefined = this.storage.recordsBySlot().get(slot);
    if (!record) throw new Error('The selected model no longer exists.');
    return this.store.getParentLevel(record.gmodel.id).previewNextLevelRemoval(record.gmodel.id);
  }

  public async removeSlot(slot: number, cascade: boolean = false): Promise<void> {
    const record: ModelRecord | undefined = this.storage.recordsBySlot().get(slot);
    if (!record) throw new Error('The selected model no longer exists.');
    const removed: ModelRemovalPreview = this.store
      .getParentLevel(record.gmodel.id)
      .removeNextLevel(record.gmodel.id, { cascade });
    this.store.removeLevels(removed.models.map((model): string => model.id));
    await this.saveCurrentModel();
  }

  public async updateNodeColors(): Promise<void> {
    const record: ModelRecord | null = this.store.currentModelRecord();
    if (!record) return;
    const view: ViewSettings = { nodeColors: this.store.currentNodeColors() };
    await this.storage.updateRecord(record.modelId, { view });
  }

  public async saveCurrentModel(): Promise<void> {
    this.store.notifyChange();
    const projectId: string | null = this.storage.selectedProjectId();
    if (!projectId) throw new Error('No project is selected.');
    const models: readonly Model[] = this.store.getModels();
    const save: Promise<void> = this.pendingSave.then((): Promise<void> => this.storage.saveModels(projectId, models));
    this.pendingSave = save.catch((): void => undefined);
    await save;
  }

  private duplicateRelations(draft: RamenModel, source: Node, copy: Node): void {
    for (const relation of draft.getModel().relations) {
      if (relation.from.nodeId !== source.id && relation.to.nodeId !== source.id) continue;
      const from: string = relation.from.nodeId === source.id ? copy.id : relation.from.nodeId;
      const to: string = relation.to.nodeId === source.id ? copy.id : relation.to.nodeId;
      draft.createRelation({
        name: relation.name,
        refines: relation.superTypes[0],
        from: { nodeId: from, bounds: relation.from.bounds, constraints: relation.from.constraints },
        to: { nodeId: to, bounds: relation.to.bounds, constraints: relation.to.constraints },
        constraints: relation.constraints,
      });
    }
  }
}
