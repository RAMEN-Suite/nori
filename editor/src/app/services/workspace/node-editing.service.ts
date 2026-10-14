import { inject, Injectable, signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { type Node, type NodeRemovalPreview, type RelationRemovalPreview } from '@ramen-suite/core/model';
import { getAffectedNodes, getAffectedRelations } from '../../utils/removal-summary';
import { ConfirmationDialog, type ConfirmationOptions } from '../../view/components/dialogs/confirmation/confirmation.dialog';
import { DialogService } from '../dialog.service';
import { NavigationService } from '../navigation.service';
import { StorageService } from '../storage.service';
import { WorkspaceService } from './workspace.service';

@Injectable({ providedIn: 'root' })
export class NodeEditingService {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly storage: StorageService = inject(StorageService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  public readonly creating: WritableSignal<boolean> = signal(false);
  public readonly createdRefinement: WritableSignal<{ modelId: string; baseNodeId: string; node: Node } | null> = signal(null);

  public async refine(baseNodeId: string): Promise<void> {
    if (this.creating() || !this.workspace.queries.editable()) return;
    const base: Node | undefined = this.workspace.store.getDraft().getNode(baseNodeId);
    const modelId: string | undefined = this.workspace.store.currentModel()?.id;
    if (!base || !modelId) return;

    const name: string = this.workspace.actions.getAvailableNodeName(base.name);

    this.creating.set(true);
    const slot: number = this.workspace.store.currentSlot();
    try {
      const node: Node = await this.workspace.actions.createNode({ name, baseNodeId });
      if (this.workspace.store.currentModel()?.id !== modelId) return;
      await this.navigation.navigateToNode(slot, node.id);
      this.createdRefinement.set({ modelId, baseNodeId, node });
    } catch (error: unknown) {
      this.storage.reportError(error);
    } finally {
      this.creating.set(false);
    }
  }

  public async duplicate(nodeId: string): Promise<void> {
    if (!this.workspace.queries.editable() || !this.workspace.queries.currentNodesById().has(nodeId)) return;
    const slot: number = this.workspace.store.currentSlot();
    const modelId: string | undefined = this.workspace.store.currentModel()?.id;
    try {
      const copy: Node = await this.workspace.actions.duplicateNode(nodeId);
      if (this.workspace.store.currentModel()?.id === modelId) await this.navigation.navigateToNode(slot, copy.id);
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }

  public confirmRemoval(nodeId: string): void {
    try {
      const node: Node | undefined = this.workspace.queries.currentNodesById().get(nodeId);
      if (!node || !this.workspace.queries.editable()) return;
      const preview: NodeRemovalPreview = this.workspace.actions.previewNodeRemoval(nodeId);
      const modelId: string | undefined = this.workspace.store.currentModel()?.id;
      const options: ConfirmationOptions = {
        title: this.translations.translate('editor.removeNodeTitle'),
        message: { key: 'editor.confirmRemoveNode', params: { name: node.name } },
        affectedNodes: getAffectedNodes(
          this.workspace.store.getModels(),
          { nodes: preview.nodes.filter((affected): boolean => affected.modelId !== modelId || affected.elementId !== node.id) },
          this.storage.records(),
        ),
        affectedRelations: getAffectedRelations(this.workspace.store.getModels(), preview, this.storage.records()),
        buttons: [
          [{ label: this.translations.translate('common.cancel'), severity: 'neutral' }],
          [
            {
              label: this.translations.translate('editor.removeNode'),
              severity: 'error',
              click: (): Promise<void> => this.remove(nodeId, modelId, preview),
            },
          ],
        ],
      };
      this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }

  public confirmCanvasRemoval(reference: string): void {
    try {
      const node: Node | undefined = this.workspace.store.getDraft().getNode(reference);
      if (!node || !this.workspace.queries.editable()) return;
      const preview: RelationRemovalPreview = this.workspace.actions.previewVisibleNodeRemoval(reference);
      const modelId: string | undefined = this.workspace.store.currentModel()?.id;
      const options: ConfirmationOptions = {
        title: this.translations.translate('editor.removeBaseNodeTitle'),
        message: { key: 'editor.confirmRemoveBaseNode', params: { name: node.name } },
        affectedRelations: getAffectedRelations(this.workspace.store.getModels(), preview, this.storage.records()),
        buttons: [
          [{ label: this.translations.translate('common.cancel'), severity: 'neutral' }],
          [
            {
              label: this.translations.translate(
                preview.relations.length ? 'editor.removeBaseNodeWithRelations' : 'editor.removeFromCanvas',
              ),
              severity: 'error',
              click: (): Promise<void> => this.removeFromCanvas(reference, modelId),
            },
          ],
        ],
      };
      this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }

  private async removeFromCanvas(reference: string, modelId: string | undefined): Promise<void> {
    if (this.workspace.store.currentModel()?.id !== modelId) throw new Error(this.translations.translate('editor.modelChanged'));
    const slot: number = this.workspace.store.currentSlot();
    await this.workspace.actions.removeVisibleNode(reference, true);
    if (this.workspace.store.currentModel()?.id === modelId && this.workspace.store.currentNodeId() === reference) {
      await this.navigation.navigateToSlot(slot);
    }
  }

  private async remove(nodeId: string, modelId: string | undefined, preview: NodeRemovalPreview): Promise<void> {
    if (this.workspace.store.currentModel()?.id !== modelId) throw new Error(this.translations.translate('editor.modelChanged'));
    const selectedId: string | null = this.workspace.store.currentNodeId();
    const clearsSelection: boolean = preview.nodes.some(
      (node): boolean => node.modelId === modelId && node.elementId === selectedId,
    );
    await this.workspace.actions.removeNode(nodeId, true);
    if (clearsSelection) await this.navigation.navigateToSlot(this.workspace.store.currentSlot());
  }
}
