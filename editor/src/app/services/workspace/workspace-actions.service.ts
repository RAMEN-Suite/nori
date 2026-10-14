import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  type Attribute,
  type AttributeInput,
  type CreateNodeInput,
  type Diagnostic,
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
  type UpdateNodeInput,
  type WorkspaceElement,
} from '@ramen-suite/core/model';
import { RamenModel, RamenModelFormat, type AnnotationInput, type AnnotationUpdate } from '@ramen-suite/core/ramen';
import { type GraphView, type ModelRecord, type NodeColors, type ViewSettings } from '../../models/ModelRecord';
import { StorageService } from '../storage.service';
import { RelationHistoryService } from './relation-history.service';
import { WorkspaceStore } from '../../states/workspace.store';

export type CreateSlotInput = Required<Pick<ModelInput, 'name' | 'uri' | 'version'>>;
export type UpdateSlotInput = CreateSlotInput;

@Injectable({ providedIn: 'root' })
export class WorkspaceActionsService {
  private readonly storage: StorageService = inject(StorageService);
  private readonly store: WorkspaceStore = inject(WorkspaceStore);
  private readonly translations: TranslocoService = inject(TranslocoService);

  private readonly relationHistory: RelationHistoryService = inject(RelationHistoryService);
  private pendingSave: Promise<void> = Promise.resolve();

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

  /** Finds a name not occupied by a local node, a visible base node or a node used through relations or annotations. */
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
    this.requireValidAttributeChange((draft: RamenModel): ModelChange<Attribute> => draft.createAttribute(nodeId, input));
    this.store.getDraft().createAttribute(nodeId, input);
    await this.saveCurrentModel();
  }

  public async updateAttribute(nodeId: string, attributeId: string, patch: UpdateAttributeInput): Promise<void> {
    this.requireValidAttributeChange(
      (draft: RamenModel): ModelChange<Attribute> => draft.updateAttribute(nodeId, attributeId, patch),
    );
    this.store.getDraft().updateAttribute(nodeId, attributeId, patch);
    await this.saveCurrentModel();
  }

  public async removeAttribute(nodeId: string, attributeId: string): Promise<void> {
    this.store.getDraft().removeAttribute(nodeId, attributeId);
    await this.saveCurrentModel();
  }

  public async createAnnotation(input: AnnotationInput): Promise<void> {
    this.store.getDraft().createAnnotation(input);
    await this.saveCurrentModel();
  }

  public async updateAnnotation(annotationId: string, input: AnnotationUpdate): Promise<void> {
    this.store.getDraft().updateAnnotation(annotationId, input);
    await this.saveCurrentModel();
  }

  public async removeAnnotation(annotationId: string): Promise<void> {
    this.store.getDraft().removeAnnotation(annotationId);
    await this.saveCurrentModel();
  }

  public async createRelation(input: RelationInput): Promise<Relation> {
    const before: readonly Model[] = this.relationHistory.capture();
    const draft: RamenModel = this.store.getDraft();
    const relation: Relation = draft.createRelation(input).element;
    this.relationHistory.record(draft.getModel().id, before);
    await this.saveCurrentModel();

    return relation;
  }

  public async undoRelation(): Promise<void> {
    await this.relationHistory.undo((): Promise<void> => this.saveCurrentModel());
  }

  public async redoRelation(): Promise<void> {
    await this.relationHistory.redo((): Promise<void> => this.saveCurrentModel());
  }

  public previewRelationRemoval(id: string): RelationRemovalPreview {
    return this.store.getDraft().previewRelationRemoval(id);
  }

  public async removeRelation(id: string, cascade: boolean = false): Promise<void> {
    const before: readonly Model[] = this.relationHistory.capture();
    const draft: RamenModel = this.store.getDraft();
    draft.removeRelation(id, { cascade });
    this.relationHistory.record(draft.getModel().id, before);
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

  public async addVisibleNode(reference: string): Promise<void> {
    const record: ModelRecord | null = this.store.currentModelRecord();
    if (!record || record.view?.visibleNodeRefs?.includes(reference)) return;

    const node: Node | undefined = this.store.getDraft().getNode(reference);
    if (!node) throw new Error(this.translations.translate('editor.nodeUnavailable'));
    this.requireAvailableNodeName(node.name);
    await this.saveView(record.modelId, { visibleNodeRefs: [...(record.view?.visibleNodeRefs ?? []), reference] });
  }

  public previewVisibleNodeRemoval(reference: string): RelationRemovalPreview {
    const draft: RamenModel = this.store.getDraft();
    const affected: Map<string, WorkspaceElement> = new Map();
    for (const relation of draft.getModel().relations) {
      if (relation.from.nodeId !== reference && relation.to.nodeId !== reference) continue;
      for (const item of draft.previewRelationRemoval(relation.id).relations) {
        affected.set(`${item.modelId}:${item.elementId}`, item);
      }
    }
    return { relations: [...affected.values()] };
  }

  public async removeVisibleNode(reference: string, cascade: boolean = false): Promise<void> {
    const record: ModelRecord | null = this.store.currentModelRecord();
    if (!record) return;
    const draft: RamenModel = this.store.getDraft();
    const connected: Relation[] = draft
      .getModel()
      .relations.filter((relation: Relation): boolean => relation.from.nodeId === reference || relation.to.nodeId === reference);
    if (connected.length && !cascade) throw new Error(this.translations.translate('editor.baseNodeConnected'));

    for (const relation of connected) {
      if (draft.getModel().relations.some((item: Relation): boolean => item.id === relation.id)) {
        draft.removeRelation(relation.id, { cascade: true });
      }
    }
    if (connected.length) await this.saveCurrentModel();
    await this.saveView(record.modelId, {
      visibleNodeRefs: (record.view?.visibleNodeRefs ?? []).filter((ref: string): boolean => ref !== reference),
    });
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

  private requireValidAttributeChange(edit: (draft: RamenModel) => ModelChange<Attribute>): void {
    const trial: RamenModel = this.store.getDraft().snapshot();
    const levels: readonly RamenModel[] = this.store
      .getModels()
      .filter(RamenModelFormat.isDocument)
      .map((model: Model): RamenModel => trial.openLevel(model.id));
    const errors: () => readonly Diagnostic[] = (): readonly Diagnostic[] =>
      levels.flatMap((level: RamenModel): readonly Diagnostic[] =>
        level.validate().diagnostics.filter((issue: Diagnostic): boolean => issue.severity === 'error'),
      );
    const previousErrors: ReadonlySet<string> = new Set(errors().map((issue: Diagnostic): string => JSON.stringify(issue)));
    edit(trial);
    const issue: Diagnostic | undefined = errors().find(
      (diagnostic: Diagnostic): boolean => !previousErrors.has(JSON.stringify(diagnostic)),
    );
    if (!issue) return;

    const messageKeys: Record<string, string> = {
      ATTRIBUTE_NAME_DUPLICATE: 'editor.propertyNameTaken',
      ATTRIBUTE_NAME_SHADOWS_SUPERTYPE: 'editor.propertyNameTaken',
      ATTRIBUTE_MULTIPLE_KEYS: 'editor.propertyMultipleKeys',
      ATTRIBUTE_BOUNDS_INVALID: 'editor.propertyInvalidBounds',
      ATTRIBUTE_KEY_BOUNDS_INVALID: 'editor.propertyKeyBounds',
    };
    const key: string = messageKeys[issue.code] ?? 'editor.propertyChangeInvalid';
    throw new Error(this.translations.translate(key, { reason: issue.message }));
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
      ...(this.store.currentModelRecord()?.view?.visibleNodeRefs ?? []),
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
