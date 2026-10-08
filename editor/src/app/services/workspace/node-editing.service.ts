import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { type Node, type NodeRemovalPreview } from '@ramen-suite/core/model';
import { WorkspaceService } from './workspace.service';
import { StorageService } from '../storage.service';
import { NavigationService } from '../navigation.service';
import { DialogService } from '../dialog.service';
import { ConfirmationDialog, type ConfirmationOptions } from '../../view/components/dialogs/confirmation/confirmation.dialog';

/** Shared node commands for the catalogue and inspector. */
@Injectable({ providedIn: 'root' })
export class NodeEditingService {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly storage: StorageService = inject(StorageService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  public async duplicate(nodeId: string): Promise<void> {
    if (!this.workspace.view.editable() || !this.workspace.view.currentNodesById().has(nodeId)) return;
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
      const node: Node | undefined = this.workspace.view.currentNodesById().get(nodeId);
      if (!node || !this.workspace.view.editable()) return;
      const preview: NodeRemovalPreview = this.workspace.actions.previewNodeRemoval(nodeId);
      const modelId: string | undefined = this.workspace.store.currentModel()?.id;
      const options: ConfirmationOptions = {
        title: this.translations.translate('editor.removeNode'),
        plainText: true,
        message: this.translations.translate('editor.confirmRemoveNode', {
          name: node.name,
          nodes: preview.nodes.length,
          relations: preview.relations.length,
        }),
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
      this.dialogs.open(ConfirmationDialog, { inputValues: { options } });
    } catch (error: unknown) {
      this.storage.reportError(error);
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
