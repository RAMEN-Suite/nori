import { computed, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Bounds, GAttribute, GDataType, GModel, GNode, GRelation } from '../models/GModel';
import { SuggestionHelper } from '../core/validation/helper/SuggestionHelper';
import { ModelValidator, ValidationResult } from '../core/validation/ModelValidator';
import { StorageService } from './storage.service';
import { Manifest } from '../models/Manifest';
import { Model } from '../models/Model';
import { GModelMutations } from '../core/GModelMutations';
import { GModelFactory } from '../core/GModelFactory';
import { WorkspaceState } from '../states/workspace.state';

export type GModelInput = { uri: string; name: string; slug: string; version: string };

@Injectable({
  providedIn: 'root',
})
export class WorkspaceService {
  public readonly activeSlot: WritableSignal<number> = signal(0);
  public readonly draft: WritableSignal<GModel | null> = signal(null);

  private readonly storage: StorageService = inject(StorageService);
  private readonly state: WorkspaceState = inject(WorkspaceState);

  private readonly suggest: SuggestionHelper = new SuggestionHelper();
  private readonly validator: ModelValidator = new ModelValidator();

  public readonly baseAlias: Signal<string> = computed((): string => this.baseModel()?.id ?? '');

  public readonly baseModel: Signal<GModel | null> = computed((): GModel | null => {
    const slot: number = this.activeSlot();
    if (slot > 0) return this.storage.modelsBySlot().get(slot - 1)?.gmodel ?? null;

    const manifest: Manifest | null = this.storage.selectedManifest();
    if (!manifest) return null;

    return (
      this.storage.metamodels().find((metamodel: GModel): boolean => {
        const isUsedMetamodel: boolean = metamodel.id === manifest.metamodelId;
        const isUsedVersion: boolean = metamodel.version === manifest.metaVersion;
        return isUsedMetamodel && isUsedVersion;
      }) ?? null
    );
  });

  public readonly derivedModel: Signal<GModel | null> = computed((): GModel | null => {
    const slot: number = this.activeSlot();
    if (slot === null) return null;

    const model: Model | undefined = this.storage.modelsBySlot().get(slot);
    return model?.gmodel ?? null;
  });

  public async createModel(input: GModelInput, description: string): Promise<void> {
    const pid: string | null = this.storage.selectedProjectId();
    const slot: number = this.activeSlot();
    if (!pid) throw new Error('No active project/slot selected.');

    const base: GModel | null = this.baseModel();
    if (!base) throw new Error(`Base model missing for slot ${slot}.`);

    const gmodel: GModel = GModelFactory.deriveModel(base, {
      schemaId: input.uri,
      id: input.slug,
      name: input.name,
      version: input.version,
    });

    await this.storage.createModel({
      projectId: pid,
      slot: slot,
      gmodel: gmodel,
      name: input.name,
      description: description,
    });

    this.initDraft();
  }

  public updateModel(patch: GModelInput): void {
    const draft: GModel | null = this.draft();
    if (!draft) throw new Error('No draft loaded.');

    const updated: GModel = {
      ...draft,
      name: patch.name ?? draft.name,
      version: patch.version ?? draft.version,
    };

    this.draft.set(updated);
  }

  public initDraft(): void {
    const gmodel: GModel | null = this.derivedModel();
    this.draft.set(gmodel ? structuredClone(gmodel) : null);
    this.state.isDirty(false);
  }

  public resetDraft(): void {
    const gmodel: GModel | null = this.derivedModel();
    this.draft.set(gmodel ? structuredClone(gmodel) : null);
    this.state.isDirty(false);
  }

  public readonly validate: Signal<ValidationResult> = computed((): ValidationResult => {
    const base: GModel | null = this.baseModel();
    const derived: GModel | null = this.draft();

    if (!base || !derived) return { diagnostics: [], hasErrors: false };
    return this.validator.validate(base, derived, {
      baseAlias: this.baseAlias(),
      throwOnSchemaError: false,
    });
  });

  public readonly baseNodes: Signal<ReadonlyArray<GNode>> = computed((): ReadonlyArray<GNode> => {
    const base: GModel | null = this.baseModel();
    if (!base) return [];
    return this.suggest.listBaseNodes(base);
  });

  public readonly baseRelations: Signal<ReadonlyArray<GRelation>> = computed(
    (): ReadonlyArray<GRelation> => {
      const base: GModel | null = this.baseModel();
      if (!base) return [];
      return this.suggest.listBaseRelations(base);
    },
  );

  public readonly dataTypes: Signal<ReadonlyArray<GDataType>> = computed(
    (): ReadonlyArray<GDataType> => {
      const base: GModel | null = this.baseModel();
      const derived: GModel | null = this.draft();
      if (!base || !derived) return [];
      return this.suggest.listDataTypes(base, derived, this.baseAlias());
    },
  );

  public listAllowedFromRelations(fromNodeId: string): ReadonlyArray<GRelation> {
    const base: GModel | null = this.baseModel();
    const derived: GModel | null = this.draft();
    if (!base || !derived) return [];
    return this.suggest.listAllowedFromRelations(base, derived, this.baseAlias(), fromNodeId);
  }

  public listAllowedToNodes(baseRelationId: string): ReadonlyArray<GNode> {
    const base: GModel | null = this.baseModel();
    const derived: GModel | null = this.draft();
    if (!base || !derived) return [];
    return this.suggest.listAllowedToNodes(base, derived, this.baseAlias(), baseRelationId);
  }

  public listForbiddenAttributeNames(nodeId: string): ReadonlySet<string> {
    const base: GModel | null = this.baseModel();
    const derived: GModel | null = this.draft();
    if (!base || !derived) return new Set<string>();
    return this.suggest.listForbiddenAttributeNames(base, derived, this.baseAlias(), nodeId);
  }

  public addNode(name: string, baseNodeId: string): void {
    const draft: GModel | null = this.draft();
    if (!draft) throw new Error('No draft loaded.');

    const node: GNode = this.suggest.createDerivedNode(this.baseAlias(), { name, baseNodeId });
    this.draft.set(GModelMutations.addClassifier(draft, node));
    this.state.isDirty(true);
  }

  public addDataType(name: string): void {
    const draft: GModel | null = this.draft();
    if (!draft) throw new Error('No draft loaded.');

    const dt: GDataType = this.suggest.createDataType({ name });
    this.draft.set(GModelMutations.addClassifier(draft, dt));
    this.state.isDirty(true);
  }

  public addAttribute(nodeId: string, name: string, typeId: string, bounds?: Bounds): void {
    const draft: GModel | null = this.draft();
    if (!draft) throw new Error('No draft loaded.');

    const attr: GAttribute = this.suggest.createAttribute({ name, typeId, bounds });
    this.draft.set(GModelMutations.addAttribute(draft, nodeId, attr));
    this.state.isDirty(true);
  }

  public addRelation(baseRelationId: string, fromNodeId: string, toNodeId: string): void {
    const draft: GModel | null = this.draft();
    const base: GModel | null = this.baseModel();
    if (!draft || !base) throw new Error('No draft/base loaded.');

    const rel: GRelation = this.suggest.createDerivedRelation(base, this.baseAlias(), {
      baseRelationId,
      fromNodeId,
      toNodeId,
    });
    this.draft.set(GModelMutations.addRelation(draft, rel));
    this.state.isDirty(true);
  }

  public async saveDraftToActiveSlot(): Promise<void> {
    const pid: string | null = this.storage.selectedProjectId();
    const slot: number = this.activeSlot();
    const draft: GModel | null = this.draft();
    const row: Model | undefined = this.storage.modelsBySlot().get(slot);

    if (!pid || !draft || !row) throw new Error('Cannot save (missing state).');

    await this.storage.updateModel(row.modelId, {
      gmodel: draft,
      name: row.name,
      description: row.description,
    });

    this.state.isDirty(false);
  }
}
