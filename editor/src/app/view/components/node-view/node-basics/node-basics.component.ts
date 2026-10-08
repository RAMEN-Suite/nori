import { type NodeRemovalPreview, Node, UpdateNodeInput } from '@ramen-suite/core/model';
import { Component, DestroyRef, effect, inject, signal, WritableSignal, ChangeDetectionStrategy } from '@angular/core';
import { Button, Chip, Input } from '@sushi-kit/angular';

import { FormsModule } from '@angular/forms';
import { StorageService } from '../../../../services/storage.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';

import { DialogService, DialogRef } from '../../../../services/dialog.service';
import { NodeColorsDialog } from '../../dialogs/node-colors/node-colors.dialog';
import { NavigationService } from '../../../../services/navigation.service';
import { ConfirmationButton, ConfirmationDialog, ConfirmationOptions } from '../../dialogs/confirmation/confirmation.dialog';

import { Transformer } from '../../../../core/helper/Transformer';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-basics',
  imports: [Button, Chip, Input, FormsModule],
  templateUrl: './node-basics.component.html',
  styleUrl: './node-basics.component.scss',
})
export class NodeBasicsComponent {
  private readonly storage: StorageService = inject(StorageService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly navigation: NavigationService = inject(NavigationService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DialogRef | null = null;

  protected readonly workingName: WritableSignal<string | null> = signal(null);
  protected readonly isWorkingNameActive: WritableSignal<boolean> = signal(false);

  public constructor() {
    effect((): void => {
      const currentName: string | undefined = this.workspace.view.currentNode()?.name;
      this.workingName.set(currentName ?? null);
    });

    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  public handleOpenColorsDialog(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(NodeColorsDialog, {
      header: 'Configure Node Colors',
    });
  }

  protected async handleDuplicateNode(): Promise<void> {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    if (!selectedId) return;
    try {
      const copy: Node = await this.workspace.actions.duplicateNode(selectedId);
      await this.navigation.navigateToNode(this.workspace.store.currentSlot(), copy.id);
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }

  protected handleDeleteNode(): void {
    const selectedNode: Node | null = this.workspace.view.currentNode();
    if (!selectedNode) return;

    const preview: NodeRemovalPreview = this.workspace.actions.previewNodeRemoval(selectedNode.id);
    const acceptButton: ConfirmationButton = {
      label: preview.nodes.length > 1 || preview.relations.length ? 'Remove with dependants' : 'Remove',
      size: 'sm',
      severity: 'error',
      variant: 'outlined',
      click: async (): Promise<void> => {
        if (!selectedNode.id) return;
        await this.workspace.actions.removeNode(selectedNode.id, true);
        const selectedSlot: number = this.workspace.store.currentSlot();
        void this.navigation.navigateToSlot(selectedSlot);
      },
    };
    const cancelButton: ConfirmationButton = {
      label: `Cancel`,
      size: 'sm',
      variant: 'outlined',
      click: (): void => this.dialogRef?.close(),
    };

    const options: ConfirmationOptions = {
      title: 'Deleting Node',
      message: `Remove ${selectedNode.name}? This removes ${preview.nodes.length} nodes and ${preview.relations.length} relationships, including dependent refinements.`,

      justify: 'justify-around',
      buttons: [[cancelButton], [acceptButton]],
    };

    this.dialogRef = this.dialogService.open(ConfirmationDialog, {
      inputValues: { options },
    });
  }

  protected async handleSave(): Promise<void> {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    const workingName: string | null = this.workingName();
    if (!selectedId || !workingName) return;

    const transformedName: string = Transformer.toPascalName(workingName);
    const patch: UpdateNodeInput = { name: transformedName };
    try {
      await this.workspace.actions.updateNode(selectedId, patch);
      this.isWorkingNameActive.set(false);
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }
}
