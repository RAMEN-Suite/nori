import { LucideTrash } from '@lucide/angular';
import { type RelationRemovalPreview, Relation } from '@ramen-suite/core/model';
import { Component, DestroyRef, inject, input, InputSignal, ChangeDetectionStrategy } from '@angular/core';

import { Button, Tooltip } from '@sushi-kit/angular';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { DialogService, DialogRef } from '../../../../../services/dialog.service';
import { ConfirmationButton, ConfirmationDialog, ConfirmationOptions } from '../../../dialogs/confirmation/confirmation.dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-relation',
  imports: [Button, Tooltip, LucideTrash],
  templateUrl: './node-relation.component.html',
  styleUrl: './node-relation.component.scss',
})
export class NodeRelationComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DialogRef | null = null;

  public readonly relation: InputSignal<Relation | undefined> = input();
  public readonly isOutgoing: InputSignal<boolean> = input(false);

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected resolveNode(nodeId: string): string {
    return this.workspace.view.editable()
      ? (this.workspace.store.getDraft().getNode(nodeId)?.name ?? nodeId)
      : (this.workspace.view.currentNodesById().get(nodeId)?.name ?? nodeId);
  }

  protected resolveRelationName(relation?: Relation): string {
    if (!relation) return '';
    return this.workspace.view.resolveBaseRelationName(relation);
  }

  protected handleDeleteRelation(): void {
    const currentRelation: Relation | undefined = this.relation();
    if (!currentRelation) return;

    const preview: RelationRemovalPreview = this.workspace.actions.previewRelationRemoval(currentRelation.id);
    const acceptButton: ConfirmationButton = {
      label: preview.relations.length > 1 ? 'Remove with refinements' : 'Remove',
      size: 'sm',
      severity: 'error',
      variant: 'outlined',
      click: async (): Promise<void> => {
        await this.workspace.actions.removeRelation(currentRelation.id, true);
      },
    };
    const cancelButton: ConfirmationButton = {
      label: `Cancel`,
      size: 'sm',
      variant: 'outlined',
      click: (): void => this.dialogRef?.close(),
    };

    const options: ConfirmationOptions = {
      title: 'Deleting Relation',
      message: `Remove ${currentRelation.name}? This removes ${preview.relations.length} relationships, including dependent refinements.`,

      justify: 'justify-around',
      buttons: [[cancelButton], [acceptButton]],
    };

    this.dialogRef = this.dialogService.open(ConfirmationDialog, {
      inputValues: { options },
    });
  }
}
