import { Component, DestroyRef, inject, input, InputSignal } from '@angular/core';
import { GRelation } from '../../../../../../core/models/GModel';
import { Button } from 'primeng/button';
import { WorkspaceService } from '../../../../../../services/workspace/workspace.service';
import { Tooltip } from 'primeng/tooltip';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CreateRelationDialog } from '../../../../dialogs/create-relation/create-relation.dialog';
import {
  ConfirmationButton,
  ConfirmationDialog,
  ConfirmationOptions,
} from '../../../../dialogs/confirmation/confirmation.dialog';

@Component({
  selector: 'app-node-relation',
  imports: [Button, Tooltip],
  providers: [DynamicDialogRef, DialogService],
  templateUrl: './node-relation.component.html',
  styleUrl: './node-relation.component.scss',
})
export class NodeRelationComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

  public relation: InputSignal<GRelation | undefined> = input();
  public isOutgoing: InputSignal<boolean> = input(false);

  constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected resolveNode(nodeId: string): string {
    return this.workspace.view.currentNodesById().get(nodeId)?.name ?? 'Unknown';
  }

  protected resolveRelationName(relation?: GRelation): string {
    if (!relation) return '';
    return this.workspace.view.resolveBaseRelationName(relation);
  }

  protected handleOpenUpdateRelation(): void {
    const currentRelation: GRelation | undefined = this.relation();
    if (!currentRelation) return;

    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateRelationDialog, {
      header: 'Edit Relation',
      closeOnEscape: true,
      draggable: true,
      closable: true,
      inputValues: { currentRelation },
    });
  }

  protected async handleDeleteRelation(): Promise<void> {
    const currentRelation: GRelation | undefined = this.relation();
    if (!currentRelation) return;

    const acceptButton: ConfirmationButton = {
      label: 'Yes, I want delete it',
      size: 'small',
      severity: 'danger',
      variant: 'outlined',
      click: async (): Promise<void> => {
        await this.workspace.actions.removeRelation(currentRelation.id);
      },
    };
    const cancelButton: ConfirmationButton = {
      label: `Cancel`,
      size: 'small',
      variant: 'outlined',
      click: (): void => this.dialogRef?.close(),
    };

    const options: ConfirmationOptions = {
      title: 'Deleting Relation',
      message: `Do you really want to delete <span class="font-bold font-stretch-semi-expanded">${currentRelation.name}</span>? <br />
      Once deleted, it is gone forever.`,
      icon: 'pi-trash',
      justify: 'justify-around',
      buttons: [[cancelButton], [acceptButton]],
    };

    this.dialogRef = this.dialogService.open(ConfirmationDialog, {
      showHeader: false,
      closeOnEscape: true,
      dismissableMask: true,
      closable: true,
      inputValues: { options },
    });
  }
}
