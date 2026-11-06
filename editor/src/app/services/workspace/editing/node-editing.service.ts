import { inject, Injectable, signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { type Node, type NodeRemovalPreview, type RelationRemovalPreview } from '@ramen-suite/core/model';
import { Subject, type Observable } from 'rxjs';
import { getAffectedNodes, getAffectedRelations } from '../../../utils/removal-summary';
import { ConfirmationDialog, type ConfirmationOptions } from '../../../view/components/dialogs/confirmation/confirmation.dialog';
import { DialogService } from '../../interaction/dialog.service';
import { NavigationService } from '../../interaction/navigation.service';
import { ProjectService } from '../../projects/project.service';
import { WorkspaceService, type WorkspaceContext } from '../workspace.service';

export interface CreatedRefinement {
  modelId: string;
  baseNodeId: string;
  node: Node;
}

/** Coordinates refinement, duplication and removal workflows shared by the graph and catalogue. */
@Injectable({ providedIn: 'root' })
export class NodeEditingService {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  public readonly isCreating: WritableSignal<boolean> = signal(false);
  private readonly refinementCreated: Subject<CreatedRefinement> = new Subject();
  public readonly createdRefinement: Observable<CreatedRefinement> = this.refinementCreated.asObservable();

  public async refine(baseNodeId: string): Promise<void> {
    if (this.isCreating() || !this.workspace.queries.isEditable()) return;
    const base: Node | undefined = this.workspace.store.getDraft().getNode(baseNodeId);
    const context: WorkspaceContext | null = this.workspace.context();
    if (!base || !context) return;

    const name: string = this.workspace.actions.getAvailableNodeName(base.name);

    this.isCreating.set(true);
    const levelIndex: number = this.workspace.store.currentLevelIndex();
    try {
      const node: Node = await this.workspace.actions.createNode({ name, baseNodeId });
      if (!this.workspace.isCurrent(context)) return;
      await this.navigation.navigateToNode(levelIndex, node.id);
      if (!this.workspace.isCurrent(context)) return;
      this.refinementCreated.next({ modelId: context.modelId, baseNodeId, node });
    } catch (error: unknown) {
      this.projects.reportError(error);
    } finally {
      this.isCreating.set(false);
    }
  }

  public async duplicate(nodeId: string): Promise<void> {
    if (!this.workspace.queries.isEditable() || !this.workspace.queries.currentNodesById().has(nodeId)) return;
    const levelIndex: number = this.workspace.store.currentLevelIndex();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!context) return;
    try {
      const copy: Node = await this.workspace.actions.duplicateNode(nodeId);
      if (this.workspace.isCurrent(context)) await this.navigation.navigateToNode(levelIndex, copy.id);
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  public confirmRemoval(nodeId: string): void {
    try {
      const node: Node | undefined = this.workspace.queries.currentNodesById().get(nodeId);
      if (!node || !this.workspace.queries.isEditable()) return;
      const preview: NodeRemovalPreview = this.workspace.actions.previewNodeRemoval(nodeId);
      const context: WorkspaceContext | null = this.workspace.context();
      if (!context) return;
      const options: ConfirmationOptions = {
        title: this.translations.translate('editor.removeNodeTitle'),
        message: { key: 'editor.confirmRemoveNode', params: { name: node.name } },
        affectedNodes: getAffectedNodes(
          this.workspace.store.getModels(),
          {
            nodes: preview.nodes.filter(
              (affected): boolean => affected.modelId !== context.modelId || affected.elementId !== node.id,
            ),
          },
          this.projects.records(),
        ),
        affectedRelations: getAffectedRelations(this.workspace.store.getModels(), preview, this.projects.records()),
        buttons: [
          [{ label: this.translations.translate('common.cancel'), severity: 'neutral' }],
          [
            {
              label: this.translations.translate('editor.removeNode'),
              severity: 'error',
              click: (): Promise<void> => this.remove(nodeId, context, preview),
            },
          ],
        ],
      };
      this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  public confirmCanvasRemoval(reference: string): void {
    try {
      const node: Node | undefined = this.workspace.store.getDraft().getNode(reference);
      if (!node || !this.workspace.queries.isEditable()) return;
      const preview: RelationRemovalPreview = this.workspace.actions.previewVisibleNodeRemoval(reference);
      const context: WorkspaceContext | null = this.workspace.context();
      if (!context) return;
      const options: ConfirmationOptions = {
        title: this.translations.translate('editor.removeBaseNodeTitle'),
        message: { key: 'editor.confirmRemoveBaseNode', params: { name: node.name } },
        affectedRelations: getAffectedRelations(this.workspace.store.getModels(), preview, this.projects.records()),
        buttons: [
          [{ label: this.translations.translate('common.cancel'), severity: 'neutral' }],
          [
            {
              label: this.translations.translate(
                preview.relations.length ? 'editor.removeBaseNodeWithRelations' : 'editor.removeFromCanvas',
              ),
              severity: 'error',
              click: (): Promise<void> => this.removeFromCanvas(reference, context),
            },
          ],
        ],
      };
      this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  private async removeFromCanvas(reference: string, context: WorkspaceContext): Promise<void> {
    if (!this.workspace.isCurrent(context)) throw new Error(this.translations.translate('editor.modelChanged'));
    const levelIndex: number = this.workspace.store.currentLevelIndex();
    await this.workspace.actions.removeVisibleNode(reference, true);
    if (this.workspace.isCurrent(context) && this.workspace.store.currentNodeId() === reference) {
      await this.navigation.navigateToLevel(levelIndex);
    }
  }

  private async remove(nodeId: string, context: WorkspaceContext, preview: NodeRemovalPreview): Promise<void> {
    if (!this.workspace.isCurrent(context)) throw new Error(this.translations.translate('editor.modelChanged'));
    const selectedId: string | null = this.workspace.store.currentNodeId();
    const clearsSelection: boolean = preview.nodes.some(
      (node): boolean => node.modelId === context.modelId && node.elementId === selectedId,
    );
    await this.workspace.actions.removeNode(nodeId, true);
    if (clearsSelection && this.workspace.isCurrent(context))
      await this.navigation.navigateToLevel(this.workspace.store.currentLevelIndex());
  }
}
