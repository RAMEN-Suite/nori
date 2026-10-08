import { computed, inject, Injectable, type Signal } from '@angular/core';
import {
  ModelRef,
  type Model,
  type Node,
  type Relation,
  type Attribute,
  type NodeSuggestion,
  type RelationSuggestion,
  type DataTypeSuggestion,
  type ProjectValidationResult,
} from '@ramen-suite/core/model';
import { RamenModelFormat, type RamenModel } from '@ramen-suite/core/ramen';
import { WorkspaceStore } from './workspace.store';
import { StorageService } from '../storage.service';
import { type ModelRecord } from '../../models/ModelRecord';

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
export class WorkspaceView {
  private readonly store: WorkspaceStore = inject(WorkspaceStore);
  private readonly storage: StorageService = inject(StorageService);

  public readonly editable: Signal<boolean> = computed((): boolean => RamenModelFormat.isDocument(this.store.currentModel()));
  public readonly validation: Signal<ProjectValidationResult | null> = computed((): ProjectValidationResult | null => {
    this.store.currentModel();
    return this.editable() ? this.store.getDraft().validate() : null;
  });
  public readonly currentNode: Signal<Node | null> = computed((): Node | null => {
    const id: string | null = this.store.currentNodeId();
    return this.currentNodes().find((node: Node): boolean => node.id === id) ?? null;
  });
  public readonly currentNodes: Signal<readonly Node[]> = computed(
    (): readonly Node[] => this.store.currentModel()?.classifiers.filter((item): item is Node => item.kind === 'Node') ?? [],
  );
  public readonly currentNodesById: Signal<ReadonlyMap<string, Node>> = computed(
    (): ReadonlyMap<string, Node> => new Map(this.currentNodes().map((node: Node): [string, Node] => [node.id, node])),
  );
  public readonly currentRelations: Signal<readonly Relation[]> = computed(
    (): readonly Relation[] => this.store.currentModel()?.relations ?? [],
  );
  public readonly currentNodeRelationsOut: Signal<readonly Relation[]> = computed((): readonly Relation[] =>
    this.nodeRelations('from'),
  );
  public readonly currentNodeRelationsIn: Signal<readonly Relation[]> = computed((): readonly Relation[] =>
    this.nodeRelations('to'),
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
  public readonly currentNodesByBaseId: Signal<ReadonlyMap<string, readonly Node[]>> = computed(
    (): ReadonlyMap<string, readonly Node[]> => {
      const groups: Map<string, Node[]> = new Map();
      for (const node of this.currentNodes()) {
        const base: string = ModelRef.localId(node.superTypes[0] ?? '');
        const items: Node[] = groups.get(base) ?? [];
        items.push(node);
        groups.set(base, items);
      }
      return groups;
    },
  );
  public readonly currentNodeChain: Signal<readonly NodeLevel[]> = computed((): readonly NodeLevel[] => {
    const node: Node | null = this.currentNode();
    if (!node || !this.validation()?.valid) return [];
    return this.store
      .getDraft()
      .getNodeLineage(node)
      .flatMap((item): NodeLevel[] => {
        const definition: Node | undefined = this.store.getDraft().getNode(item);
        return definition && definition.id !== node.id ? [{ modelId: item.modelId, node: definition }] : [];
      });
  });
  public readonly inheritedAttributes: Signal<ReadonlyMap<string, readonly InheritedAttribute[]>> = computed(
    (): ReadonlyMap<string, readonly InheritedAttribute[]> => this.collectInheritedAttributes(),
  );
  public readonly currentBaseNode: Signal<Node | null> = computed(
    (): Node | null => this.currentNodeChain().at(-1)?.node ?? null,
  );

  public resolveAllowedRelations(target: string, direction: 'IN' | 'OUT'): readonly RelationSuggestion[] {
    const node: Node | null = this.currentNode();
    if (!node || !this.validation()?.valid) return [];
    return direction === 'OUT'
      ? this.store.getDraft().suggestRelations(node, target)
      : this.store.getDraft().suggestRelations(target, node);
  }

  public resolveReachableNodes(direction: 'IN' | 'OUT'): readonly Node[] {
    const node: Node | null = this.currentNode();
    if (!node || !this.validation()?.valid) return [];
    const candidates: Map<string, Node> = new Map(this.currentNodes().map((item: Node): [string, Node] => [item.id, item]));
    const draft: RamenModel = this.store.getDraft();
    for (const suggestion of this.nodeSuggestions()) {
      const target: Node | undefined = draft.getNode(suggestion.ref);
      if (target) candidates.set(suggestion.ref, { ...target, id: suggestion.ref });
    }

    return [...candidates.values()].filter(
      (target: Node): boolean => this.resolveAllowedRelations(target.id, direction).length > 0,
    );
  }

  public resolveTypeLabel(typeId: string, _modelId: string): string {
    const type: DataTypeSuggestion | undefined = this.dataTypeSuggestions().find(
      (item: DataTypeSuggestion): boolean => item.ref === typeId || item.dataTypeId === typeId,
    );
    return type?.name ?? typeId;
  }

  public resolveBaseRelationName(relation: Relation): string {
    return relation.name;
  }

  private nodeRelations(end: 'from' | 'to'): readonly Relation[] {
    const model: Model | null = this.store.currentModel();
    const node: Node | null = this.currentNode();
    if (!model || !node) return [];
    return this.currentRelations().filter((relation: Relation): boolean =>
      ModelRef.matches(relation[end].nodeId, model.id, node.id),
    );
  }

  private collectInheritedAttributes(): ReadonlyMap<string, readonly InheritedAttribute[]> {
    const groups: Map<string, InheritedAttribute[]> = new Map();
    const node: Node | null = this.currentNode();
    if (!node || !this.validation()?.valid) return groups;
    for (const info of this.store.getDraft().getAttributes(node)) {
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
