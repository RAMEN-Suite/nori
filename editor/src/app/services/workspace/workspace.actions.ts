import { computed, effect, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  type AttributeInput,
  type CreateDataTypeInput,
  type CreateNodeInput,
  type DataType,
  type Model,
  type ModelChange,
  type ModelInput,
  type ModelRemovalPreview,
  type Node,
  type NodeRemovalPreview,
  type Relation,
  type RelationInput,
  type RelationRemovalPreview,
  type UpdateAttributeInput,
  type UpdateDataTypeInput,
  type UpdateNodeInput,
  type UpdateRelationInput,
} from '@ramen-suite/core/model';
import { RamenModel } from '@ramen-suite/core/ramen';
import { type GraphView, type ModelRecord, type NodeColors, type ViewSettings } from '../../models/ModelRecord';
import { StorageService } from '../storage.service';
import { WorkspaceStore } from './workspace.store';

interface CreatedRelation {
  readonly modelId: string;
  readonly id: string;
  readonly definition: string;
}

export type CreateSlotInput = Required<Pick<ModelInput, 'name' | 'uri' | 'version'>>;
export type UpdateSlotInput = CreateSlotInput;

@Injectable({ providedIn: 'root' })
export class WorkspaceActions {
  private readonly storage: StorageService = inject(StorageService);
  private readonly store: WorkspaceStore = inject(WorkspaceStore);
  private readonly translations: TranslocoService = inject(TranslocoService);

  private readonly relationHistory: WritableSignal<readonly CreatedRelation[]> = signal([]);
  private readonly undoing: WritableSignal<boolean> = signal(false);
  private pendingSave: Promise<void> = Promise.resolve();

  public readonly canUndoRelation: Signal<boolean> = computed((): boolean => {
    const modelId: string | undefined = this.store.currentModel()?.id;
    return !this.undoing() && this.relationHistory().some((entry: CreatedRelation): boolean => entry.modelId === modelId);
  });

  public constructor() {
    effect((): void => {
      this.storage.loadedProjectId();
      this.relationHistory.set([]);
    });
  }

  public async createNode(input: CreateNodeInput): Promise<Node> {
    this.requireAvailableNodeName(input.name);
    const change: ModelChange<Node> = this.store.getDraft().createNode({ name: input.name, refines: input.baseNodeId });
    await this.saveCurrentModel();

    return change.element;
  }

  public async updateNode(nodeId: string, patch: UpdateNodeInput): Promise<void> {
    if (patch.name !== undefined) this.requireAvailableNodeName(patch.name, nodeId);
    this.store.getDraft().updateNode(nodeId, patch);
    await this.saveCurrentModel();
  }

  /** Finds a name not occupied by a local node or a node used through relations or annotations. */
  public getAvailableNodeName(preferred: string): string {
    const names: ReadonlySet<string> = this.usedNodeNames();
    let name: string = preferred.slice(0, 40);
    let suffix: number = 2;
    while (names.has(name)) {
      const ending: string = String(suffix++);
      name = `${preferred.slice(0, 40 - ending.length)}${ending}`;
    }
    return name;
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
      name: this.getAvailableNodeName(`${node.name}Copy`),
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
    const draft: RamenModel = this.store.getDraft();
    const relation: Relation = draft.createRelation(input).element;
    const modelId: string = draft.getModel().id;
    this.relationHistory.update((history: readonly CreatedRelation[]): readonly CreatedRelation[] => [
      ...history,
      { modelId, id: relation.id, definition: JSON.stringify(relation) },
    ]);
    await this.saveCurrentModel();

    return relation;
  }

  /** Reverses the latest unchanged relationship creation on the active level. */
  public async undoRelation(): Promise<void> {
    if (!this.canUndoRelation()) return;
    const modelId: string | undefined = this.store.currentModel()?.id;
    const entry: CreatedRelation | undefined = [...this.relationHistory()]
      .reverse()
      .find((item: CreatedRelation): boolean => item.modelId === modelId);
    if (!entry) return;

    const draft: RamenModel = this.store.getDraft();
    const relation: Relation | undefined = draft.getModel().relations.find((item: Relation): boolean => item.id === entry.id);
    if (relation && JSON.stringify(relation) !== entry.definition) {
      throw new Error(this.translations.translate('editor.undoRelationChanged'));
    }
    this.undoing.set(true);
    try {
      if (relation) draft.removeRelation(entry.id);
      this.relationHistory.update((history: readonly CreatedRelation[]): readonly CreatedRelation[] =>
        history.filter((item: CreatedRelation): boolean => item !== entry),
      );
      if (relation) await this.saveCurrentModel();
    } finally {
      this.undoing.set(false);
    }
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
    const parent: RamenModel | null = this.store.getCreationParent();
    const next: RamenModel = parent ? parent.createNextLevel(input) : RamenModel.create(input);
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

  public async updateNodeColors(recordId: string, colours: NodeColors): Promise<void> {
    await this.saveView(recordId, { nodeColors: colours });
  }

  public async toggleVisibleNode(reference: string): Promise<void> {
    const record: ModelRecord | null = this.store.currentModelRecord();
    if (!record) return;

    const visible: Set<string> = new Set(record.view?.visibleNodeRefs ?? []);
    if (visible.has(reference)) visible.delete(reference);
    else visible.add(reference);
    await this.saveView(record.modelId, { visibleNodeRefs: [...visible] });
  }

  public async updateGraphView(recordId: string, graph: GraphView): Promise<void> {
    await this.saveView(recordId, { graph });
  }

  public async saveCurrentModel(): Promise<void> {
    this.store.notifyChange();
    const projectId: string | null = this.storage.selectedProjectId();
    if (!projectId) throw new Error('No project is selected.');
    const models: readonly Model[] = this.store.getModels();
    await this.enqueueSave((): Promise<void> => this.storage.saveModels(projectId, models));
  }

  private async saveView(recordId: string, patch: Partial<ViewSettings>): Promise<void> {
    const record: ModelRecord | undefined = this.storage
      .records()
      .find((item: ModelRecord): boolean => item.modelId === recordId);
    if (!record) return;

    await this.enqueueSave(async (): Promise<void> => {
      // A queued graph update can outlive its level or the open project.
      const exists: boolean = this.storage
        .records()
        .some((item: ModelRecord): boolean => item.modelId === recordId && item.projectId === record.projectId);
      if (exists) await this.storage.updateView(recordId, patch);
    });
  }

  /** Preserve write order while letting a later save recover from an earlier failure. */
  private async enqueueSave(action: () => Promise<void>): Promise<void> {
    const save: Promise<void> = this.pendingSave.then(action);
    this.pendingSave = save.catch((): void => undefined);
    await save;
  }

  private requireAvailableNodeName(name: string, excludedId?: string): void {
    if (this.usedNodeNames(excludedId).has(name)) {
      throw new Error(this.translations.translate('editor.nodeNameTaken', { name }));
    }
  }

  private usedNodeNames(excludedId?: string): ReadonlySet<string> {
    const draft: RamenModel = this.store.getDraft();
    const model: Model = draft.getModel();
    const names: Set<string> = new Set(
      model.classifiers
        .filter((item): item is Node => item.kind === 'Node' && item.id !== excludedId)
        .map((node: Node): string => node.name),
    );

    const references: readonly string[] = [
      ...model.relations.flatMap((relation: Relation): string[] => [relation.from.nodeId, relation.to.nodeId]),
      ...draft.getAnnotations().map((annotation): string => annotation.annotationId),
    ];
    for (const reference of new Set(references)) {
      const node: Node | undefined = draft.getNode(reference);
      if (node && node.id !== excludedId) names.add(node.name);
    }

    return names;
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
