import { computed, inject, Injectable, Signal } from '@angular/core';
import { StorageService } from '../storage.service';
import { WorkspaceStore } from './workspace.store';
import { SuggestionHelper } from '../../core/helper/SuggestionHelper';
import { ModelValidator, ValidationResult } from '../../core/validation/ModelValidator';
import { GAttribute, GDataType, GModel, GNode, GRelation, Id, TypeRef } from '../../core/models/GModel';
import { BaseNode, SemanticHelper, SuperTypeChainItem } from '../../core/helper/SemanticHelper';
import { GModelIndex } from '../../core/validation/container/GModelIndex';
import { Builtins, QualifiedRefParts, Refs } from '../../core/validation/container/References';

export interface InheritedAttribute {
  readonly slot: number;
  readonly modelId: Id;
  readonly nodeId: Id;
  readonly nodeName: string;
  readonly attribute: GAttribute;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceQueries {
  private readonly storage: StorageService = inject(StorageService);
  private readonly store: WorkspaceStore = inject(WorkspaceStore);

  private readonly helper: SuggestionHelper = new SuggestionHelper();
  private readonly validator: ModelValidator = new ModelValidator();

  private readonly indexesByModelId: Signal<ReadonlyMap<Id, GModelIndex>> = computed((): Map<string, GModelIndex> => {
    const map: Map<Id, GModelIndex> = new Map<Id, GModelIndex>();
    const models: ReadonlyMap<Id, GModel> = this.storage.modelsById();
    for (const [id, model] of models.entries()) map.set(id, new GModelIndex(model));
    return map;
  });

  private readonly baseSlot: Signal<number | null> = computed((): number | null => {
    const selectedSlot: number = this.store.selectedSlot();
    return Math.max(0, selectedSlot - 1);
  });

  public readonly baseModel: Signal<GModel | null> = computed((): GModel | null => {
    const baseSlot: number | null = this.baseSlot();
    if (baseSlot === null) return null;
    return this.storage.recordsBySlot().get(baseSlot)?.gmodel ?? null;
  });

  public readonly slotModel: Signal<GModel | null> = computed((): GModel | null => {
    const selectedSlot: number = this.store.selectedSlot();
    return this.storage.recordsBySlot().get(selectedSlot)?.gmodel ?? null;
  });

  public readonly baseId: Signal<Id> = computed((): Id => {
    return this.baseModel()?.id ?? '';
  });

  public readonly validation: Signal<ValidationResult> = computed((): ValidationResult => {
    const base: GModel | null = this.baseModel();
    const work: GModel | null = this.store.workingModel();

    if (!base || !work) return { diagnostics: [], hasErrors: false };
    return this.validator.validate(base, work, this.storage.modelsById());
  });

  public readonly baseNodes: Signal<GNode[]> = computed((): GNode[] => {
    const base: GModel | null = this.baseModel();
    return base ? Array.from(this.helper.listNodes(base)) : [];
  });

  public readonly workNodes: Signal<GNode[]> = computed((): GNode[] => {
    const work: GModel | null = this.store.workingModel();
    return work ? Array.from(this.helper.listNodes(work)) : [];
  });

  public readonly baseRelations: Signal<GRelation[]> = computed((): GRelation[] => {
    const base: GModel | null = this.baseModel();
    return base ? Array.from(this.helper.listRelations(base)) : [];
  });

  public readonly dataTypes: Signal<GDataType[]> = computed((): GDataType[] => {
    const base: GModel | null = this.baseModel();
    const work: GModel | null = this.store.workingModel();

    if (!base || !work) return [];
    return Array.from(this.helper.listAllDataTypes(base, work));
  });

  public readonly dataTypesByWork: Signal<GDataType[]> = computed((): GDataType[] => {
    const work: GModel | null = this.store.workingModel();
    return work ? Array.from(this.helper.listDataTypes(work)) : [];
  });

  public readonly inheritedAttributes: Signal<ReadonlyMap<Id, ReadonlyArray<InheritedAttribute>>> = computed(
    (): ReadonlyMap<Id, ReadonlyArray<InheritedAttribute>> => {
      const map: Map<Id, InheritedAttribute[]> = new Map<Id, InheritedAttribute[]>();

      this.selectedWorkNodeChain().forEach((item: SuperTypeChainItem, index: number): void => {
        if (item.node.attributes.length === 0) return;

        const list: InheritedAttribute[] = item.node.attributes.map((attribute: GAttribute): InheritedAttribute => {
          return {
            slot: index,
            modelId: item.modelId,
            nodeId: item.node.id,
            nodeName: item.node.name,
            attribute: attribute,
          };
        });

        map.set(item.node.id, list);
      });

      return map;
    },
  );

  public readonly baseNodesById: Signal<ReadonlyMap<Id, GNode>> = computed((): ReadonlyMap<Id, GNode> => {
    const model: GModel | null = this.baseModel();
    if (!model) return new Map<Id, GNode>();

    const baseNodes: ReadonlyArray<GNode> = this.helper.listNodes(model);
    const baseNodesById: Map<Id, GNode> = new Map<Id, GNode>();
    for (const baseNode of baseNodes) baseNodesById.set(baseNode.id, baseNode);

    return baseNodesById;
  });

  public readonly workNodesById: Signal<ReadonlyMap<Id, GNode>> = computed((): ReadonlyMap<Id, GNode> => {
    const work: GModel | null = this.store.workingModel();
    if (!work) return new Map<Id, GNode>();

    const workNodes: ReadonlyArray<GNode> = this.helper.listNodes(work);
    const workNodesById: Map<Id, GNode> = new Map<Id, GNode>();
    for (const workNode of workNodes) workNodesById.set(workNode.id, workNode);

    return workNodesById;
  });

  public readonly workNodesByBaseId: Signal<ReadonlyMap<Id, ReadonlyArray<GNode>>> = computed(
    (): ReadonlyMap<Id, ReadonlyArray<GNode>> => {
      const base: GModel | null = this.baseModel();
      const work: GModel | null = this.store.workingModel();
      if (!base || !work) return new Map<Id, ReadonlyArray<GNode>>();
      return this.helper.groupDerivedNodesByBaseId(base, work);
    },
  );

  public readonly selectedWorkNode: Signal<GNode | null> = computed((): GNode | null => {
    const selectedNodeId: Id | null = this.store.selectedNodeId();
    if (!selectedNodeId) return null;
    const workNodesById: ReadonlyMap<Id, GNode> = this.workNodesById();
    return workNodesById.get(selectedNodeId) ?? null;
  });

  public readonly selectedWorkNodeChain: Signal<ReadonlyArray<SuperTypeChainItem>> = computed(
    (): ReadonlyArray<SuperTypeChainItem> => {
      const slotModel: GModel | null = this.slotModel();
      const selectedNode: GNode | null = this.selectedWorkNode();
      if (!slotModel || !selectedNode) return [];

      const modelsById: ReadonlyMap<Id, GModel> = this.storage.modelsById();
      return SemanticHelper.getSuperTypeChain(slotModel.id, selectedNode.id, modelsById);
    },
  );

  public readonly selectedBaseNode: Signal<GNode | null> = computed((): GNode | null => {
    const base: GModel | null = this.baseModel();
    const work: GNode | null = this.selectedWorkNode();
    if (!base || !work) return null;

    const baseNodeReference: BaseNode | null = SemanticHelper.getBaseSuperType(work, base.id);
    if (!baseNodeReference) return null;

    const baseNodesById: ReadonlyMap<Id, GNode> = this.baseNodesById();
    return baseNodesById.get(baseNodeReference.baseNodeId) ?? null;
  });

  public resolveDataType(typeId: TypeRef, modelId: Id): GDataType | null {
    if (Builtins.isBuiltin(typeId)) return null;
    const indexes: ReadonlyMap<Id, GModelIndex> = this.indexesByModelId();

    if (Refs.isQualified(typeId)) {
      const parts: QualifiedRefParts = Refs.splitQualified(typeId);
      const index: GModelIndex | undefined = indexes.get(parts.modelId);
      return index?.dataTypesById.get(parts.nodeId) ?? null;
    }

    const index: GModelIndex | undefined = indexes.get(modelId);
    return index?.dataTypesById.get(typeId) ?? null;
  }

  public resolveTypeLabel(typeId: TypeRef, modelId: Id): string {
    if (Builtins.isBuiltin(typeId)) return typeId;
    const dataType: GDataType | null = this.resolveDataType(typeId, modelId);
    if (!dataType) return `Unknown type (${String(typeId)})`;

    return dataType.name;
  }
}
