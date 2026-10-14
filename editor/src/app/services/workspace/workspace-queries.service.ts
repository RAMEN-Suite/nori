import { computed, inject, Injectable, type Signal } from '@angular/core';
import {
  ModelRef,
  type Attribute,
  type DataTypeSuggestion,
  type Model,
  type Node,
  type NodeSuggestion,
  type ProjectValidationResult,
  type Relation,
  type RelationSuggestion,
} from '@ramen-suite/core/model';
import { RamenModelFormat, type RamenModel } from '@ramen-suite/core/ramen';
import { type ModelRecord } from '../../models/ModelRecord';
import { StorageService } from '../storage.service';
import { WorkspaceStore } from '../../states/workspace.store';

export interface InheritedAttribute {
  readonly modelId: string;
  readonly slot: number;
  readonly nodeId: string;
  readonly nodeName: string;
  readonly attribute: Attribute;
}

export interface NodeLevel {
  readonly modelId: string;
  readonly node: Node;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceQueriesService {
  private readonly store: WorkspaceStore = inject(WorkspaceStore);
  private readonly storage: StorageService = inject(StorageService);

  public readonly editable: Signal<boolean> = computed((): boolean => RamenModelFormat.isDocument(this.store.currentModel()));
  public readonly validation: Signal<ProjectValidationResult | null> = computed((): ProjectValidationResult | null => {
    this.store.currentModel();
    return this.editable() ? this.store.getDraft().validate() : null;
  });
  public readonly currentNode: Signal<Node | null> = computed((): Node | null => {
    const id: string | null = this.store.currentNodeId();
    if (!id) return null;
    return this.editable() ? (this.store.getDraft().getNode(id) ?? null) : (this.currentNodesById().get(id) ?? null);
  });
  public readonly nodeOwner: Signal<ModelRecord | null> = computed((): ModelRecord | null => {
    const id: string | null = this.store.currentNodeId();
    const modelId: string | undefined =
      id && ModelRef.isQualified(id) ? ModelRef.splitQualified(id).modelId : this.store.currentModel()?.id;
    return this.storage.records().find((record: ModelRecord): boolean => record.gmodel.id === modelId) ?? null;
  });
  public readonly nodeEditable: Signal<boolean> = computed(
    (): boolean => this.editable() && this.nodeOwner()?.gmodel.id === this.store.currentModel()?.id,
  );
  public readonly currentNodes: Signal<readonly Node[]> = computed(
    (): readonly Node[] => this.store.currentModel()?.classifiers.filter((item): item is Node => item.kind === 'Node') ?? [],
  );
  public readonly currentNodesById: Signal<ReadonlyMap<string, Node>> = computed(
    (): ReadonlyMap<string, Node> => new Map(this.currentNodes().map((node: Node): [string, Node] => [node.id, node])),
  );
  public readonly currentRelation: Signal<Relation | null> = computed(
    (): Relation | null =>
      this.currentRelations().find((relation: Relation): boolean => relation.id === this.store.currentRelationId()) ?? null,
  );
  public readonly currentRelations: Signal<readonly Relation[]> = computed(
    (): readonly Relation[] => this.store.currentModel()?.relations ?? [],
  );
  public readonly nodeSuggestions: Signal<readonly NodeSuggestion[]> = computed((): readonly NodeSuggestion[] =>
    this.validation()?.valid ? this.store.getDraft().suggestNodes() : [],
  );
  public readonly dataTypeSuggestions: Signal<readonly DataTypeSuggestion[]> = computed((): readonly DataTypeSuggestion[] =>
    this.validation()?.valid ? this.store.getDraft().suggestDataTypes() : [],
  );
  public readonly baseModel: Signal<Model | null> = computed((): Model | null => {
    const id: string | undefined = this.store.currentModel()?.imports[0]?.modelId;
    return this.storage.modelsById().get(id ?? '') ?? null;
  });
  public readonly baseNodes: Signal<readonly Node[]> = computed(
    (): readonly Node[] => this.baseModel()?.classifiers.filter((item): item is Node => item.kind === 'Node') ?? [],
  );
  public readonly currentNodeChain: Signal<readonly NodeLevel[]> = computed((): readonly NodeLevel[] => {
    const node: Node | null = this.currentNode();
    if (!node || !this.validation()?.valid) return [];
    return this.store
      .getDraft()
      .getNodeLineage(this.store.currentNodeId() ?? node.id)
      .flatMap((item): NodeLevel[] => {
        const definition: Node | undefined = this.store.getDraft().getNode(item);
        return definition && definition.id !== node.id ? [{ modelId: item.modelId, node: definition }] : [];
      });
  });
  public readonly inheritedAttributes: Signal<ReadonlyMap<string, readonly InheritedAttribute[]>> = computed(
    (): ReadonlyMap<string, readonly InheritedAttribute[]> => this.collectInheritedAttributes(),
  );

  public resolveNodeLabel(reference: string): string {
    const modelId: string | undefined = ModelRef.isQualified(reference)
      ? ModelRef.splitQualified(reference).modelId
      : this.store.currentModel()?.id;
    const model: Model | undefined = this.store.getModels().find((item: Model): boolean => item.id === modelId);
    return (
      model?.classifiers.find((item): boolean => item.kind === 'Node' && item.id === ModelRef.localId(reference))?.name ??
      reference
    );
  }

  public resolveNodeBase(node: Node, ownerId: string | undefined = this.store.currentModel()?.id): NodeLevel | null {
    const reference: string | undefined = node.superTypes[0];
    if (!reference || !ownerId || !this.editable()) return null;

    const ref: string = ModelRef.isQualified(reference) ? reference : ModelRef.qualify(ownerId, reference);
    const base: Node | undefined = this.store.getDraft().getNode(ref);
    return base ? { modelId: ModelRef.splitQualified(ref).modelId, node: base } : null;
  }

  /** Offer the most specific member of each relation family, keeping independent alternatives. */
  public resolveRelationChoices(from: string, to: string): readonly RelationSuggestion[] {
    const draft: RamenModel = this.store.getDraft();
    const choices: readonly RelationSuggestion[] = draft.suggestRelations(from, to);
    const validation: ProjectValidationResult = draft.validate();
    if (!validation.valid) return choices;

    const ancestors: Set<string> = new Set();
    for (const choice of choices) {
      for (const ancestor of validation.graph.getRelationAncestors(choice.modelId, choice.relationId)) {
        ancestors.add(ModelRef.qualify(ancestor.modelId, ancestor.element.id));
      }
    }
    return choices.filter((choice: RelationSuggestion): boolean => !ancestors.has(choice.ref));
  }

  public resolveTypeLabel(typeId: string, modelSlot: number = this.store.currentSlot()): string {
    const modelId: string | undefined = this.storage.recordsBySlot().get(modelSlot)?.gmodel.id;
    if (!modelId) return typeId;

    const reference: string = ModelRef.isQualified(typeId) ? typeId : ModelRef.qualify(modelId, typeId);
    const reader: RamenModel = this.editable() ? this.store.getDraft() : this.store.getWorkspace();
    return reader.getDataType(reference)?.name ?? typeId;
  }

  private collectInheritedAttributes(): ReadonlyMap<string, readonly InheritedAttribute[]> {
    const groups: Map<string, InheritedAttribute[]> = new Map();
    const reference: string | null = this.store.currentNodeId();
    if (!reference || !this.validation()?.valid) return groups;
    for (const info of this.store.getDraft().getAttributes(reference)) {
      if (!info.inherited) continue;
      const owner: Node | undefined = this.store.getDraft().getNode(info.declaredBy);
      const attribute: Attribute | undefined = owner?.attributes.find((item: Attribute): boolean => item.id === info.attributeId);
      if (!owner || !attribute) continue;
      const slot: number =
        this.storage.records().find((record: ModelRecord): boolean => record.gmodel.id === info.declaredBy.modelId)?.slot ?? 0;
      const items: InheritedAttribute[] = groups.get(owner.id) ?? [];
      items.push({ slot, attribute, modelId: info.declaredBy.modelId, nodeId: owner.id, nodeName: owner.name });
      groups.set(owner.id, items);
    }
    return groups;
  }
}
