import { LucidePencil, LucideTrash, LucideArrowUpRight } from '@lucide/angular';
import { Component, DestroyRef, inject, input, InputSignal, model, ModelSignal, ChangeDetectionStrategy } from '@angular/core';
import { Button, Tooltip, Badge } from '@sushi-kit/angular';

import { Bounds, Attribute } from '@ramen-suite/core/model';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { NavigationService } from '../../../../../services/navigation.service';
import { DialogService, DialogRef } from '../../../../../services/dialog.service';
import { CreateAttributeDialog } from '../../../dialogs/create-attribute/create-attribute.dialog';
import { ConfirmationButton, ConfirmationDialog, ConfirmationOptions } from '../../../dialogs/confirmation/confirmation.dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-attribute',
  imports: [Button, Tooltip, Badge, LucidePencil, LucideTrash, LucideArrowUpRight],
  templateUrl: './node-attribute.component.html',
  styleUrl: './node-attribute.component.scss',
})
export class NodeAttributeComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly navigation: NavigationService = inject(NavigationService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DialogRef | null = null;

  public readonly nodeId: InputSignal<string | undefined> = input();
  public readonly modelId: InputSignal<string | undefined> = input();
  public readonly modelSlot: InputSignal<number> = input(0);

  public readonly attribute: ModelSignal<Attribute | undefined> = model();

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected formatAttributeType(bounds: Bounds, typeName: string): string {
    const upper: string = bounds.upperBound === -1 ? '*' : String(bounds.upperBound);
    return `${typeName} · ${bounds.lowerBound}..${upper}`;
  }

  protected handleOpenUpdateAttribute(): void {
    const currentAttribute: Attribute | undefined = this.attribute();
    if (!currentAttribute) return;

    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateAttributeDialog, {
      header: 'Edit Attribute',

      inputValues: { currentAttribute },
    });
  }

  protected handleDeleteAttribute(): void {
    const currentAttribute: Attribute | undefined = this.attribute();
    if (!currentAttribute) return;

    const currentNodeId: string | null = this.workspace.store.currentNodeId();
    if (!currentNodeId) return;

    const acceptButton: ConfirmationButton = {
      label: 'Yes, I want delete it',
      size: 'sm',
      severity: 'error',
      variant: 'outlined',
      click: async (): Promise<void> => {
        await this.workspace.actions.removeAttribute(currentNodeId, currentAttribute.id);
      },
    };
    const cancelButton: ConfirmationButton = {
      label: `Cancel`,
      size: 'sm',
      variant: 'outlined',
      click: (): void => this.dialogRef?.close(),
    };

    const options: ConfirmationOptions = {
      title: 'Deleting Attribute',
      message: `Do you really want to delete <span class="font-bold font-stretch-semi-expanded">${currentAttribute.name}</span>? <br />
      Once deleted, it is gone forever.`,

      justify: 'justify-around',
      buttons: [[cancelButton], [acceptButton]],
    };

    this.dialogRef = this.dialogService.open(ConfirmationDialog, {
      inputValues: { options },
    });
  }

  protected handleOpenQualifiedReference(): void {
    const slot: number | undefined = this.modelSlot();
    const nodeId: string | undefined = this.nodeId();
    if (!nodeId) return;

    void this.navigation.navigateToNode(slot, nodeId);
  }
}
