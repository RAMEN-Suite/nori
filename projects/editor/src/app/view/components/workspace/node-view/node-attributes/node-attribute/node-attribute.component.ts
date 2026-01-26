import { Component, DestroyRef, inject, input, InputSignal, model, ModelSignal } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Bounds, GAttribute } from '../../../../../../core/models/GModel';
import { WorkspaceService } from '../../../../../../services/workspace/workspace.service';
import { NavigationService } from '../../../../../../services/navigation.service';
import { ActivatedRoute } from '@angular/router';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CreateAttributeDialog } from '../../../../dialogs/create-attribute/create-attribute.dialog';
import {
  ConfirmationButton,
  ConfirmationDialog,
  ConfirmationOptions,
} from '../../../../dialogs/confirmation/confirmation.dialog';

const FORMATS = {
  EXCLAMATION: "<span class='font-bold ms-1 text-red-500'>!</span>",
  LIST: "<span class='font-bold me-1'>[</span>%s<span class='font-bold ms-1'>]</span>",
  UPPER_BOUND: "<span class='font-bold'>(%s)</span>",
};

@Component({
  selector: 'app-node-attribute',
  imports: [Button, Tooltip],
  providers: [DialogService, DynamicDialogRef],
  templateUrl: './node-attribute.component.html',
  styleUrl: './node-attribute.component.scss',
})
export class NodeAttributeComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly navigation: NavigationService = inject(NavigationService);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

  public nodeId: InputSignal<string | undefined> = input();
  public modelId: InputSignal<string | undefined> = input();
  public modelSlot: InputSignal<number> = input(0);

  public attribute: ModelSignal<GAttribute | undefined> = model();

  constructor() {
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

  protected handleOpenCreateAttribute(): void {
    const currentAttribute: GAttribute | undefined = this.attribute();
    if (!currentAttribute) return;

    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateAttributeDialog, {
      header: 'Create Attribute',
      closeOnEscape: true,
      draggable: true,
      closable: true,
      inputValues: { currentAttribute },
    });
  }

  protected async handleDeleteAttribute(): Promise<void> {
    const currentAttribute: GAttribute | undefined = this.attribute();
    if (!currentAttribute) return;

    const currentNodeId: string | null = this.workspace.store.currentNodeId();
    if (!currentNodeId) return;

    const acceptButton: ConfirmationButton = {
      label: 'Yes, I want delete it',
      size: 'small',
      severity: 'danger',
      variant: 'outlined',
      click: async (): Promise<void> => {
        await this.workspace.actions.removeAttribute(currentNodeId, currentAttribute.name);
      },
    };
    const cancelButton: ConfirmationButton = {
      label: `Cancel`,
      size: 'small',
      variant: 'outlined',
      click: (): void => this.dialogRef?.close(),
    };

    const options: ConfirmationOptions = {
      title: 'Deleting Attribute',
      message: `Do you really want to delete <span class="font-bold font-stretch-semi-expanded">${currentAttribute.name}</span>? <br />
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

  protected handleOpenQualifiedReference(): void {
    const slot: number | undefined = this.modelSlot();
    const nodeId: string | undefined = this.nodeId();
    if (!slot || !nodeId || slot === 0) return;

    void this.navigation.navigateToNode(this.activatedRoute, slot, nodeId);
  }
}
