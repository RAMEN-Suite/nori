import { inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ModelRef, type Relation, type RelationRemovalPreview, type RelationSuggestion } from '@ramen-suite/core/model';
import { type RamenModel } from '@ramen-suite/core/ramen';
import { getAffectedRelations } from '../../../utils/removal-summary';
import { ChooseRelationDialog } from '../../../view/components/dialogs/choose-relation/choose-relation.dialog';
import { ConfirmationDialog, type ConfirmationOptions } from '../../../view/components/dialogs/confirmation/confirmation.dialog';
import { DialogService } from '../../interaction/dialog.service';
import { ProjectService } from '../../projects/project.service';
import { WorkspaceService, type WorkspaceContext } from '../workspace.service';

/** Coordinates relationship creation and removal dialogs against the captured project and model. */
@Injectable({ providedIn: 'root' })
export class RelationEditingService {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  private readonly working: WritableSignal<boolean> = signal(false);
  public readonly pending: Signal<boolean> = this.working.asReadonly();

  public async connect(from: string, to: string): Promise<void> {
    if (this.pending() || !this.workspace.queries.editable()) return;
    try {
      const draft: RamenModel = this.workspace.store.getDraft();
      const choices: readonly RelationSuggestion[] = this.workspace.queries.resolveRelationChoices(from, to);
      const context: WorkspaceContext = this.requireContext();
      if (!choices.length) throw new Error(this.translations.translate('editor.noRelation'));

      const connect: (ref: string) => Promise<void> = (ref: string): Promise<void> => this.create(from, to, ref, context);
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
      this.projects.reportError(error);
    }
  }

  public remove(id: string): void {
    if (this.pending() || !this.workspace.queries.editable()) return;
    try {
      const draft: RamenModel = this.workspace.store.getDraft();
      const relation: Relation | undefined = draft.getRelation(id);
      if (!relation) return;

      const preview: RelationRemovalPreview = this.workspace.actions.previewRelationRemoval(id);
      const context: WorkspaceContext = this.requireContext();
      this.confirmRelationRemoval(id, relation, draft, context, preview);
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  private confirmRelationRemoval(
    id: string,
    relation: Relation,
    draft: RamenModel,
    context: WorkspaceContext,
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
            (affected): boolean => affected.modelId !== context.modelId || affected.elementId !== relation.id,
          ),
        },
        this.projects.records(),
      ),
      buttons: [
        [
          { label: this.translations.translate('common.cancel'), severity: 'neutral' },
          {
            label: this.translations.translate('editor.removeConnection'),
            severity: 'error',
            click: (): Promise<void> => this.removeConfirmedRelation(id, context),
          },
        ],
      ],
    };

    this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
  }

  private async removeConfirmedRelation(id: string, context: WorkspaceContext): Promise<void> {
    this.ensureContext(context);
    await this.perform((): Promise<void> => this.workspace.actions.removeRelation(id, true));
  }

  private async create(from: string, to: string, ref: string, context: WorkspaceContext): Promise<void> {
    this.ensureContext(context);
    const draft: RamenModel = this.workspace.store.getDraft();
    if (
      ModelRef.splitQualified(ref).modelId === context.modelId &&
      draft.getRelations(from, to).some((relation): boolean => relation.ref === ref)
    ) {
      throw new Error(this.translations.translate('editor.relationExists'));
    }

    await this.perform(async (): Promise<void> => {
      await this.workspace.actions.createRelation({ refines: ref, from: { nodeId: from }, to: { nodeId: to } });
    });
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    this.working.set(true);
    try {
      await action();
    } finally {
      this.working.set(false);
    }
  }

  private requireContext(): WorkspaceContext {
    const context: WorkspaceContext | null = this.workspace.context();
    if (!context) throw new Error(this.translations.translate('editor.modelChanged'));
    return context;
  }

  private ensureContext(context: WorkspaceContext): void {
    if (!this.workspace.isCurrent(context)) throw new Error(this.translations.translate('editor.modelChanged'));
  }
}
