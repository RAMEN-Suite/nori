import { computed, inject, Injectable, type Signal } from '@angular/core';
import {
  DataTypes,
  ModelRef,
  type DataTypeSuggestion,
  type Model,
  type Node,
  type NodeSuggestion,
  type ProjectValidationResult,
  type Relation,
  type RelationSuggestion,
} from '@ramen-suite/core/model';
import { RamenModelFormat, type RamenModel } from '@ramen-suite/core/ramen';
import { type ModelRecord } from '../../../models/ModelRecord';
import { type InheritedAttribute, type NodeDefinition } from '../../../models/WorkspaceDetails';
import { WorkspaceStore } from '../../../states/workspace.store';
import { indexBy } from '../../../utils/collections';
import { ModelQueries } from '../../../utils/model-queries';
import { ProjectService } from '../../projects/project.service';

/** Derives selection details, inherited properties, suggestions and validation from workspace state. */
@Injectable({ providedIn: 'root' })
export class WorkspaceQueriesService {
  private readonly store: WorkspaceStore = inject(WorkspaceStore);
  private readonly projects: ProjectService = inject(ProjectService);

  public readonly editable: Signal<boolean> = computed((): boolean => RamenModelFormat.isDocument(this.store.currentModel()));
  public readonly validation: Signal<ProjectValidationResult | null> = computed((): ProjectValidationResult | null =>
    this.editable() ? this.store.getDraft().validate() : null,
  );
  public readonly baseModel: Signal<Model | null> = computed((): Model | null => {
    const id: string | undefined = this.store.currentModel()?.imports[0]?.modelId;
    return id ? (this.projects.modelsById().get(id) ?? null) : null;
  });
  public readonly baseNodes: Signal<readonly Node[]> = computed((): readonly Node[] => ModelQueries.nodes(this.baseModel()));
  public readonly currentNodes: Signal<readonly Node[]> = computed((): readonly Node[] =>
    ModelQueries.nodes(this.store.currentModel()),
  );
  public readonly currentNodesById: Signal<ReadonlyMap<string, Node>> = computed(
    (): ReadonlyMap<string, Node> => indexBy(this.currentNodes(), (node: Node): string => node.id),
  );
  public readonly currentRelations: Signal<readonly Relation[]> = computed(
    (): readonly Relation[] => this.store.currentModel()?.relations ?? [],
  );
  public readonly currentNode: Signal<Node | null> = computed((): Node | null => {
    const reference: string | null = this.store.currentNodeId();
    if (!reference) return null;
    return this.editable()
      ? (this.store.getDraft().getNode(reference) ?? null)
      : (this.currentNodesById().get(reference) ?? null);
  });
  public readonly currentRelation: Signal<Relation | null> = computed(
    (): Relation | null =>
      this.currentRelations().find((relation): boolean => relation.id === this.store.currentRelationId()) ?? null,
  );
  public readonly nodeOwner: Signal<ModelRecord | null> = computed((): ModelRecord | null => {
    const reference: string | null = this.store.currentNodeId();
    if (!reference) return null;
    const modelId: string | undefined = ModelRef.isQualified(reference)
      ? ModelRef.splitQualified(reference).modelId
      : this.store.currentModel()?.id;
    return modelId ? (this.projects.recordsByModelId().get(modelId) ?? null) : null;
  });
  public readonly nodeEditable: Signal<boolean> = computed(
    (): boolean =>
      this.editable() && this.currentNode() !== null && this.nodeOwner()?.gmodel.id === this.store.currentModel()?.id,
  );
  public readonly currentNodeChain: Signal<readonly NodeDefinition[]> = computed((): readonly NodeDefinition[] => {
    const reference: string | null = this.store.currentNodeId();
    return reference && this.validation()?.valid ? ModelQueries.nodeAncestors(this.store.getDraft(), reference) : [];
  });
  public readonly inheritedAttributes: Signal<ReadonlyMap<string, readonly InheritedAttribute[]>> = computed(() => {
    const reference: string | null = this.store.currentNodeId();
    return reference && this.validation()?.valid
      ? ModelQueries.inheritedAttributes(this.store.getDraft(), reference, this.projects.recordsByModelId())
      : new Map<string, readonly InheritedAttribute[]>();
  });
  public readonly nodeSuggestions: Signal<readonly NodeSuggestion[]> = computed((): readonly NodeSuggestion[] =>
    this.validation()?.valid ? this.store.getDraft().suggestNodes() : [],
  );
  public readonly dataTypeSuggestions: Signal<readonly DataTypeSuggestion[]> = computed((): readonly DataTypeSuggestion[] =>
    this.validation()?.valid
      ? this.store.getDraft().suggestDataTypes()
      : Object.values(DataTypes).map((type): DataTypeSuggestion => ({ dataTypeId: type, ref: type, name: type, baseType: type })),
  );

  public resolveNodeLabel(reference: string): string {
    const reader: RamenModel | null = this.editable() ? this.store.getDraft() : null;
    const local: Node | undefined = ModelRef.isQualified(reference) ? undefined : this.currentNodesById().get(reference);
    return reader?.getNode(reference)?.name ?? local?.name ?? reference;
  }

  public resolveNodeBase(node: Node, ownerId: string | undefined = this.store.currentModel()?.id): NodeDefinition | null {
    const reference: string | undefined = node.superTypes[0];
    if (!reference || !ownerId || !this.editable()) return null;
    const ref: string = ModelRef.isQualified(reference) ? reference : ModelRef.qualify(ownerId, reference);
    const base: Node | undefined = this.store.getDraft().getNode(ref);
    return base ? { modelId: ModelRef.splitQualified(ref).modelId, node: base } : null;
  }

  public resolveRelationChoices(from: string, to: string): readonly RelationSuggestion[] {
    const draft: RamenModel = this.store.getDraft();
    return ModelQueries.specificRelations(draft.suggestRelations(from, to), draft.validate());
  }

  public resolveTypeLabel(typeId: string, levelIndex: number = this.store.currentLevelIndex()): string {
    const modelId: string | undefined = this.projects.recordsByLevelIndex().get(levelIndex)?.gmodel.id;
    if (!modelId) return typeId;
    const reference: string = ModelRef.isQualified(typeId) ? typeId : ModelRef.qualify(modelId, typeId);
    return this.store.getWorkspace().getDataType(reference)?.name ?? typeId;
  }
}
