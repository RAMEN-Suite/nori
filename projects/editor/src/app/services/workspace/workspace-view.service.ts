import { computed, inject, Injectable, Signal } from '@angular/core';
import { StorageService } from '../storage.service';
import { WorkspaceStoreService } from './workspace-store.service';
import { SuggestionHelper } from '../../core/validation/helper/SuggestionHelper';
import { ModelValidator, ValidationResult } from '../../core/validation/ModelValidator';
import { GDataType, GModel, GNode, GRelation, Id } from '../../core/models/GModel';
import { Model } from '../../models/Model';
import { BaseNode, SemanticHelper } from '../../core/validation/helper/SemanticHelper';

@Injectable({ providedIn: 'root' })
export class WorkspaceViewService {
  private readonly storage: StorageService = inject(StorageService);
  private readonly store: WorkspaceStoreService = inject(WorkspaceStoreService);

  private readonly helper: SuggestionHelper = new SuggestionHelper();
  private readonly validator: ModelValidator = new ModelValidator();

  private readonly baseSlot: Signal<number> = computed((): number => {
    return Math.max(0, this.store.selectedSlot() - 1);
  });

  public readonly baseModel: Signal<GModel | null> = computed((): GModel | null => {
    const model: Model | undefined = this.storage.modelsBySlot().get(this.baseSlot());
    return model?.gmodel ?? null;
  });

  public readonly slotModel: Signal<GModel | null> = computed((): GModel | null => {
    const model: Model | undefined = this.storage.modelsBySlot().get(this.store.selectedSlot());
    return model?.gmodel ?? null;
  });

  public readonly baseId: Signal<Id> = computed((): Id => {
    return this.baseModel()?.id ?? '';
  });

  public readonly validation: Signal<ValidationResult> = computed((): ValidationResult => {
    const base: GModel | null = this.baseModel();
    const work: GModel | null = this.store.workingModel();

    if (!base || !work) return { diagnostics: [], hasErrors: false };
    return this.validator.validate(base, work);
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

  public readonly baseNodesById: Signal<ReadonlyMap<Id, GNode>> = computed(
    (): ReadonlyMap<Id, GNode> => {
      const model: GModel | null = this.baseModel();
      if (!model) return new Map<Id, GNode>();

      const baseNodes: ReadonlyArray<GNode> = this.helper.listNodes(model);
      const baseNodesById: Map<Id, GNode> = new Map<Id, GNode>();
      for (const baseNode of baseNodes) baseNodesById.set(baseNode.id, baseNode);

      return baseNodesById;
    },
  );

  public readonly workNodesById: Signal<ReadonlyMap<Id, GNode>> = computed(
    (): ReadonlyMap<Id, GNode> => {
      const work: GModel | null = this.store.workingModel();
      if (!work) return new Map<Id, GNode>();

      const workNodes: ReadonlyArray<GNode> = this.helper.listNodes(work);
      const workNodesById: Map<Id, GNode> = new Map<Id, GNode>();
      for (const workNode of workNodes) workNodesById.set(workNode.id, workNode);

      return workNodesById;
    },
  );

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

  public readonly selectedBaseNode: Signal<GNode | null> = computed((): GNode | null => {
    const base: GModel | null = this.baseModel();
    const work: GNode | null = this.selectedWorkNode();
    if (!base || !work) return null;

    const baseNodeReference: BaseNode | null = SemanticHelper.getBaseSuperType(work, base.id);
    if (!baseNodeReference) return null;

    const baseNodesById: ReadonlyMap<Id, GNode> = this.baseNodesById();
    return baseNodesById.get(baseNodeReference.baseNodeId) ?? null;
  });
}
