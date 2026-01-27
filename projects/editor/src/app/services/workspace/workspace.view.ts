import { computed, inject, Injectable, Signal } from '@angular/core';
import { StorageService } from '../storage.service';
import { WorkspaceStore } from './workspace.store';
import { ModelValidator, ValidationResult } from '../../core/validation/ModelValidator';
import { GAttribute, GDataType, GModel, GNode, GRelation, Id, TypeRef } from '../../core/models/GModel';
import { GModelIndex } from '../../core/validation/container/GModelIndex';
import { QualifiedParts, Reference } from '../../core/validation/container/Reference';
import { QueryHelper, SelectableRelation } from '../../core/helper/QueryHelper';
import { NodeResolver, ResolvedNode } from '../../core/resolver/NodeResolver';
import { Builtins } from '../../core/validation/container/Builtins';
import { RelationResolver } from '../../core/resolver/RelationResolver';

export interface InheritedAttribute {
  readonly modelId: Id;
  readonly slot: number;
  readonly nodeId: Id;
  readonly nodeName: string;
  readonly attribute: GAttribute;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceView {
  private readonly storage: StorageService = inject(StorageService);
  private readonly store: WorkspaceStore = inject(WorkspaceStore);

  private readonly indexesByModelId: Signal<ReadonlyMap<Id, GModelIndex>> = computed((): Map<string, GModelIndex> => {
    const map: Map<Id, GModelIndex> = new Map<Id, GModelIndex>();
    const models: ReadonlyMap<Id, GModel> = this.storage.modelsById();
    for (const [id, model] of models.entries()) map.set(id, new GModelIndex(model));
    return map;
  });

  public readonly baseId: Signal<Readonly<Id>> = computed((): Id => {
    return this.baseModel()?.id ?? '';
  });

  public readonly baseSlot: Signal<Readonly<number | null>> = computed((): number | null => {
    const slot: number = this.store.currentSlot();
    return Math.max(0, slot - 1);
  });

  public readonly baseModel: Signal<Readonly<GModel | null>> = computed((): GModel | null => {
    const model: number | null = this.baseSlot();
    if (model === null) return null;
    return this.storage.recordsBySlot().get(model)?.gmodel ?? null;
  });

  public readonly validation: Signal<Readonly<ValidationResult>> = computed((): ValidationResult => {
    const baseModel: GModel | null = this.baseModel();
    const currentModel: GModel | null = this.store.currentModel();

    if (!baseModel || !currentModel) return { diagnostics: [], hasErrors: false };
    const validator: ModelValidator = new ModelValidator();
    return validator.validate(baseModel, currentModel, this.storage.modelsById());
  });

  public readonly currentNode: Signal<Readonly<GNode | null>> = computed((): GNode | null => {
    const currentNodeId: Id | null = this.store.currentNodeId();
    if (!currentNodeId) return null;
    const currentNodesById: ReadonlyMap<Id, GNode> = this.currentNodesById();
    return currentNodesById.get(currentNodeId) ?? null;
  });

  public readonly currentNodes: Signal<ReadonlyArray<GNode>> = computed((): GNode[] => {
    const model: GModel | null = this.store.currentModel();
    return model ? Array.from(QueryHelper.listNodes(model)) : [];
  });

  public readonly currentNodesById: Signal<ReadonlyMap<Id, GNode>> = computed((): Map<Id, GNode> => {
    const nodes: ReadonlyArray<GNode> = this.currentNodes();
    const nodesById: Map<Id, GNode> = new Map<Id, GNode>();
    for (const node of nodes) nodesById.set(node.id, node);
    return nodesById;
  });

  public readonly currentNodesByBaseId: Signal<ReadonlyMap<Id, ReadonlyArray<GNode>>> = computed(
    (): ReadonlyMap<Id, ReadonlyArray<GNode>> => {
      const baseModel: GModel | null = this.baseModel();
      const currentModel: GModel | null = this.store.currentModel();
      if (!baseModel || !currentModel) return new Map<Id, ReadonlyArray<GNode>>();
      return QueryHelper.listGroupedNodesByBaseId(baseModel, currentModel);
    },
  );

  public readonly currentRelations: Signal<ReadonlyArray<GRelation>> = computed((): GRelation[] => {
    const model: GModel | null = this.store.currentModel();
    return model ? Array.from(QueryHelper.listRelations(model)) : [];
  });

  public readonly currentBaseRelations: Signal<ReadonlyArray<GRelation>> = computed((): GRelation[] => {
    const baseNode: GNode | null = this.currentBaseNode();
    const baseRelations: ReadonlyArray<GRelation> = this.baseRelations();
    if (!baseNode) return [];

    const picked: GRelation[] = baseRelations.filter((relation: GRelation): boolean => {
      return relation.from.nodeId === baseNode.id || relation.to.nodeId === baseNode.id;
    });

    const relationById: Map<Id, GRelation> = new Map<Id, GRelation>();
    for (const relation of picked) relationById.set(relation.id, relation);
    return Array.from(relationById.values()).sort((a: GRelation, b: GRelation): number => a.name.localeCompare(b.name));
  });

  public readonly currentNodeRelationsOut: Signal<ReadonlyArray<GRelation>> = computed((): ReadonlyArray<GRelation> => {
    const relations: ReadonlyArray<GRelation> = this.currentRelations();
    const node: GNode | null = this.currentNode();
    if (!node) return [];

    return relations
      .filter((relation: GRelation): boolean => relation.from.nodeId === node.id)
      .sort((a: GRelation, b: GRelation): number => a.name.localeCompare(b.name));
  });

  public readonly currentNodeRelationsIn: Signal<ReadonlyArray<GRelation>> = computed((): ReadonlyArray<GRelation> => {
    const relations: ReadonlyArray<GRelation> = this.currentRelations();
    const node: GNode | null = this.currentNode();
    if (!node) return [];

    return relations
      .filter((relation: GRelation): boolean => relation.to.nodeId === node.id)
      .sort((a: GRelation, b: GRelation): number => a.name.localeCompare(b.name));
  });

  public readonly currentSelectableRelations: Signal<ReadonlyArray<SelectableRelation>> = computed(
    (): ReadonlyArray<SelectableRelation> => {
      const base: GModel | null = this.baseModel();
      const model: GModel | null = this.store.currentModel();
      const node: GNode | null = this.currentNode();
      if (!base || !model || !node) return [];
      return QueryHelper.listSelectableRelations(base, model, node.id);
    },
  );

  public readonly currentRelationRoles: Signal<ReadonlySet<string>> = computed((): ReadonlySet<string> => {
    const model: GModel | null = this.store.currentModel();
    const node: GNode | null = this.currentNode();
    if (!model || !node) return new Set<string>();
    return QueryHelper.listRelationRoles(model, node.id);
  });

  public readonly currentDataTypes: Signal<ReadonlyArray<GDataType>> = computed((): GDataType[] => {
    const model: GModel | null = this.store.currentModel();
    return model ? Array.from(QueryHelper.listDataTypes(model)) : [];
  });

  public readonly currentNodeChain: Signal<ReadonlyArray<ResolvedNode>> = computed((): ReadonlyArray<ResolvedNode> => {
    const model: GModel | null = this.store.currentModel();
    const node: GNode | null = this.currentNode();
    if (!model || !node) return [];

    const modelsById: ReadonlyMap<Id, GModel> = this.storage.modelsById();
    return QueryHelper.listNodeChain(model.id, node.id, modelsById);
  });

  public readonly currentBaseNode: Signal<Readonly<GNode | null>> = computed((): GNode | null => {
    const baseModel: GModel | null = this.baseModel();
    const currentModel: GNode | null = this.currentNode();
    if (!baseModel || !currentModel) return null;

    const parts: QualifiedParts | null = NodeResolver.resolveLocalSuperType(currentModel.superTypes, baseModel.id);
    if (!parts) return null;

    const baseNodesById: ReadonlyMap<Id, GNode> = this.baseNodesById();
    return baseNodesById.get(parts.refId) ?? null;
  });

  public readonly baseNodes: Signal<ReadonlyArray<GNode>> = computed((): GNode[] => {
    const model: GModel | null = this.baseModel();
    return model ? Array.from(QueryHelper.listNodes(model)) : [];
  });

  public readonly baseNodesById: Signal<ReadonlyMap<Id, GNode>> = computed((): Map<Id, GNode> => {
    const model: GModel | null = this.baseModel();
    if (!model) return new Map<Id, GNode>();

    const nodes: ReadonlyArray<GNode> = QueryHelper.listNodes(model);
    const nodesById: Map<Id, GNode> = new Map<Id, GNode>();
    for (const baseNode of nodes) nodesById.set(baseNode.id, baseNode);
    return nodesById;
  });

  public readonly baseRelations: Signal<Readonly<GRelation[]>> = computed((): GRelation[] => {
    const model: GModel | null = this.baseModel();
    return model ? Array.from(QueryHelper.listRelations(model)) : [];
  });

  public readonly globalDataTypes: Signal<GDataType[]> = computed((): GDataType[] => {
    const baseModel: GModel | null = this.baseModel();
    const currentModel: GModel | null = this.store.currentModel();
    if (!baseModel || !currentModel) return [];
    return Array.from(QueryHelper.listGlobalDataTypes(currentModel, this.storage.modelsById()));
  });

  public readonly inheritedAttributes: Signal<ReadonlyMap<Id, ReadonlyArray<InheritedAttribute>>> = computed(
    (): Map<Id, InheritedAttribute[]> => {
      const map: Map<Id, InheritedAttribute[]> = new Map<Id, InheritedAttribute[]>();

      this.currentNodeChain().forEach((item: ResolvedNode, slot: number): void => {
        if (item.node.attributes.length === 0) return;

        const list: InheritedAttribute[] = item.node.attributes.map((attribute: GAttribute): InheritedAttribute => {
          return { slot, attribute, modelId: item.modelId, nodeId: item.node.id, nodeName: item.node.name };
        });

        map.set(item.node.id, list);
      });

      return map;
    },
  );

  public readonly inheritedAttributeNames: Signal<ReadonlySet<string>> = computed((): Set<string> => {
    const attributeNames: Set<string> = new Set<string>();
    const attributes: GAttribute[] = this.currentNode()?.attributes ?? [];
    const nodeChain: ReadonlyArray<ResolvedNode> = this.currentNodeChain();

    for (const attribute of attributes) {
      attributeNames.add(attribute.name);
    }

    for (const level of nodeChain) {
      for (const attribute of level.node.attributes) {
        attributeNames.add(attribute.name);
      }
    }

    return attributeNames;
  });

  public resolveDataType(typeId: TypeRef, modelId: Id): Readonly<GDataType | null> {
    if (Builtins.isBuiltin(typeId)) return null;
    const indexes: ReadonlyMap<Id, GModelIndex> = this.indexesByModelId();

    if (Reference.isQualified(typeId)) {
      const parts: QualifiedParts = Reference.splitQualified(typeId);
      const index: GModelIndex | undefined = indexes.get(parts.modelId);
      return index?.dataTypesById.get(parts.refId) ?? null;
    }

    const index: GModelIndex | undefined = indexes.get(modelId);
    return index?.dataTypesById.get(typeId) ?? null;
  }

  public resolveTypeLabel(typeId: TypeRef, modelId: Id): Readonly<string> {
    if (Builtins.isBuiltin(typeId)) return typeId;
    const dataType: GDataType | null = this.resolveDataType(typeId, modelId);
    if (!dataType) return `Unknown type (${String(typeId)})`;

    return dataType.name;
  }

  public resolveNodesForRelation(selection: SelectableRelation): ReadonlyArray<GNode> {
    const base: GModel | null = this.baseModel();
    const model: GModel | null = this.store.currentModel();
    if (!base || !model) return [];

    if (selection.direction === 'OUT') return QueryHelper.listRelationToNodes(base, model, selection.baseRelationId);
    return QueryHelper.listRelationFromNodes(base, model, selection.baseRelationId);
  }

  public resolveBaseRelationName(relation: GRelation): Readonly<string> {
    const base: GModel | null = this.baseModel();
    if (!base) return relation.name;

    const baseName: string | null = RelationResolver.resolveBaseRelationName(base, relation);
    return baseName ?? relation.name;
  }
}
