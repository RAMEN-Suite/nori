import { effect, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ModelRef, type Relation, type RelationRemovalPreview, type RelationSuggestion } from '@ramen-suite/core/model';
import { type RamenModel } from '@ramen-suite/core/ramen';
import { getAffectedRelations } from '../../core/utils/RemovalSummary';
import { ChooseRelationDialog } from '../../view/components/dialogs/choose-relation/choose-relation.dialog';
import { ConfirmationDialog, type ConfirmationOptions } from '../../view/components/dialogs/confirmation/confirmation.dialog';
import { DialogService } from '../dialog.service';
import { StorageService } from '../storage.service';
import { WorkspaceService } from './workspace.service';

export type GraphTool = 'select' | 'connect' | 'erase';

/** Coordinates graph tools with Core suggestions and dependent removal previews. */
@Injectable({ providedIn: 'root' })
export class GraphToolsService {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly storage: StorageService = inject(StorageService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  private readonly selectedSource: WritableSignal<string | null> = signal(null);
  private readonly activeTool: WritableSignal<GraphTool> = signal('select');
  private readonly working: WritableSignal<boolean> = signal(false);
  private modelId: string | undefined;

  public readonly source: Signal<string | null> = this.selectedSource.asReadonly();
  public readonly tool: Signal<GraphTool> = this.activeTool.asReadonly();
  public readonly pending: Signal<boolean> = this.working.asReadonly();

  public constructor() {
    effect((): void => {
      const modelId: string | undefined = this.workspace.store.currentModel()?.id;
      if (modelId === this.modelId) return;
      this.modelId = modelId;
      this.exit();
    });
  }

  public toggle(tool: GraphTool): void {
    if (this.pending() || !this.workspace.view.editable()) return;
    this.cancel();
    this.activeTool.update((active: GraphTool): GraphTool => (active === tool ? 'select' : tool));
  }

  public selectSource(id: string): void {
    this.selectedSource.set(id);
  }

  public exit(): void {
    this.activeTool.set('select');
    this.cancel();
  }

  public cancel(): void {
    this.selectedSource.set(null);
  }

  public async connect(from: string, to: string): Promise<void> {
    if (this.pending() || !this.workspace.view.editable()) return;
    try {
      const draft: RamenModel = this.workspace.store.getDraft();
      const choices: readonly RelationSuggestion[] = this.workspace.view.resolveRelationChoices(from, to);
      const modelId: string | undefined = this.workspace.store.currentModel()?.id;
      if (!choices.length) throw new Error(this.translations.translate('editor.noRelation'));

      const connect: (ref: string) => Promise<void> = (ref: string): Promise<void> => this.create(from, to, ref, modelId);
      if (choices.length === 1 && choices[0]) await connect(choices[0].ref);
      else
        this.dialogs.open(ChooseRelationDialog, {
          size: 'compact',
          headerKey: 'editor.chooseRelation',
          inputValues: {
            choices,
            connect,
            fromName: draft.getNode(from)?.name,
            toName: draft.getNode(to)?.name,
          },
        });
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }

  public remove(id: string): void {
    if (this.pending() || !this.workspace.view.editable()) return;
    try {
      const draft: RamenModel = this.workspace.store.getDraft();
      const relation: Relation | undefined = draft.getRelation(id);
      if (!relation) return;

      const preview: RelationRemovalPreview = this.workspace.actions.previewRelationRemoval(id);
      const modelId: string | undefined = this.workspace.store.currentModel()?.id;
      this.confirmRelationRemoval(id, relation, draft, modelId, preview);
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }

  private confirmRelationRemoval(
    id: string,
    relation: Relation,
    draft: RamenModel,
    modelId: string | undefined,
    preview: RelationRemovalPreview,
  ): void {
    const options: ConfirmationOptions = {
      title: this.translations.translate('editor.removeConnectionTitle'),
      message: {
        key: 'editor.confirmRemoveConnection',
        params: {
          name: relation.name,
          from: draft.getNode(relation.from.nodeId)?.name,
          to: draft.getNode(relation.to.nodeId)?.name,
        },
      },
      affectedRelations: getAffectedRelations(
        this.workspace.store.getModels(),
        {
          relations: preview.relations.filter(
            (affected): boolean => affected.modelId !== modelId || affected.elementId !== relation.id,
          ),
        },
        this.storage.records(),
      ),
      buttons: [
        [
          { label: this.translations.translate('common.cancel'), severity: 'neutral' },
          {
            label: this.translations.translate('editor.removeConnection'),
            severity: 'error',
            click: (): Promise<void> => this.removeConfirmedRelation(id, modelId),
          },
        ],
      ],
    };

    this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
  }

  private async removeConfirmedRelation(id: string, modelId: string | undefined): Promise<void> {
    this.ensureModel(modelId);
    await this.workspace.actions.removeRelation(id, true);
  }

  private async create(from: string, to: string, ref: string, modelId: string | undefined): Promise<void> {
    this.ensureModel(modelId);
    const draft: RamenModel = this.workspace.store.getDraft();
    if (
      ModelRef.splitQualified(ref).modelId === modelId &&
      draft.getRelations(from, to).some((relation): boolean => relation.ref === ref)
    ) {
      throw new Error(this.translations.translate('editor.relationExists'));
    }

    this.working.set(true);
    try {
      await this.workspace.actions.createRelation({ refines: ref, from: { nodeId: from }, to: { nodeId: to } });
    } finally {
      this.working.set(false);
    }
  }

  private ensureModel(modelId: string | undefined): void {
    if (this.workspace.store.currentModel()?.id !== modelId) throw new Error(this.translations.translate('editor.modelChanged'));
  }
}
