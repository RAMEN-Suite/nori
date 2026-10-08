import { Component, DestroyRef, inject, input, InputSignal, model, ModelSignal, ChangeDetectionStrategy } from '@angular/core';
import { Button, Tooltip, Chip } from '@sushi-kit/angular';

import { Bounds, Attribute } from '@ramen-suite/core/model';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { NavigationService } from '../../../../../services/navigation.service';
import { DialogService, DialogRef } from '../../../../../services/dialog.service';
import { CreateAttributeDialog } from '../../../dialogs/create-attribute/create-attribute.dialog';
import { ConfirmationButton, ConfirmationDialog, ConfirmationOptions } from '../../../dialogs/confirmation/confirmation.dialog';

const FORMATS: Readonly<{ EXCLAMATION: string; LIST: string; UPPER_BOUND: string }> = {
  EXCLAMATION: "<span class='font-bold ms-1 text-red-500 font-stretch-200%'>!</span>",
  LIST: "<span class='font-bold me-1'>[</span>%s<span class='font-bold ms-1'>]</span>",
  UPPER_BOUND: "<span class='font-bold'>(%s)</span>",
};

interface AttributeChip {
  tooltip: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-attribute',
  imports: [Button, Tooltip, Chip],
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
    const { lowerBound, upperBound } = bounds;
    const isRequired: boolean = lowerBound > 0;
    const requiredSuffix: string = isRequired ? FORMATS.EXCLAMATION : '';

    if (upperBound === 1) {
      return `${typeName}${requiredSuffix}`;
    }

    if (upperBound === -1) {
      const listName: string = FORMATS.LIST.replace('%s', typeName);
      return `${listName}${requiredSuffix}`;
    }

    if (upperBound > 1) {
      const listName: string = FORMATS.LIST.replace('%s', typeName);
      const upperBoundSuffix: string = FORMATS.UPPER_BOUND.replace('%s', String(upperBound));
      return `${listName}${upperBoundSuffix}${requiredSuffix}`;
    }

    return `${typeName}${requiredSuffix}`;
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
    if (!slot || !nodeId || slot === 0) return;

    void this.navigation.navigateToNode(slot, nodeId);
  }

  protected getCollectionChip(attribute: Attribute | undefined): AttributeChip | null {
    if (!attribute || attribute.bounds.upperBound === 1) return null;
    if (attribute.isOrdered) return { tooltip: 'List preserves element order' };
    if (attribute.isUnique) return { tooltip: 'List contains no duplicates' };
    return null;
  }
}
