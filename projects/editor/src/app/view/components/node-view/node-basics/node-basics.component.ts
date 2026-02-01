import { Component, DestroyRef, effect, inject, signal, WritableSignal } from '@angular/core';
import { Button } from 'primeng/button';
import { Chip } from 'primeng/chip';
import { Inplace } from 'primeng/inplace';
import { InputText } from 'primeng/inputtext';
import { Panel } from 'primeng/panel';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Tooltip } from 'primeng/tooltip';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { NgStyle } from '@angular/common';
import { GNode } from '../../../../core/models/GModel';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { NodeColorsDialog } from '../../dialogs/node-colors/node-colors.dialog';
import { AutoFocus } from 'primeng/autofocus';
import { NavigationService } from '../../../../services/navigation.service';
import { ActivatedRoute } from '@angular/router';
import {
  ConfirmationButton,
  ConfirmationDialog,
  ConfirmationOptions,
} from '../../dialogs/confirmation/confirmation.dialog';
import { AutoselectDirective } from '../../../../directives/autoselect.directive';
import { UpdateNodeInput } from '../../../../core/GModelMutations';
import { Transformer } from '../../../../core/helper/Transformer';

@Component({
  selector: 'app-node-basics',
  imports: [
    Button,
    Chip,
    Inplace,
    InputText,
    Panel,
    ReactiveFormsModule,
    Tooltip,
    FormsModule,
    NgStyle,
    AutoFocus,
    AutoselectDirective,
  ],
  providers: [DialogService, DynamicDialogRef],
  templateUrl: './node-basics.component.html',
  styleUrl: './node-basics.component.scss',
})
export class NodeBasicsComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly navigation: NavigationService = inject(NavigationService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

  protected workingName: WritableSignal<string | null> = signal(null);
  protected isWorkingNameActive: WritableSignal<boolean> = signal(false);

  constructor() {
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
      closeOnEscape: true,
      dismissableMask: true,
      draggable: true,
      closable: true,
    });
  }

  protected async handleDuplicateNode(): Promise<void> {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    if (!selectedId) return;
    await this.workspace.actions.duplicateNode(selectedId);
  }

  protected async handleDeleteNode(): Promise<void> {
    const selectedNode: GNode | null = this.workspace.view.currentNode();
    if (!selectedNode) return;

    const acceptButton: ConfirmationButton = {
      label: 'Yes, I want delete it',
      size: 'small',
      severity: 'danger',
      variant: 'outlined',
      click: async (): Promise<void> => {
        if (!selectedNode.id) return;
        await this.workspace.actions.removeNode(selectedNode.id);
        const selectedSlot: number = this.workspace.store.currentSlot();
        void this.navigation.navigateToSlot(this.activatedRoute, selectedSlot);
      },
    };
    const cancelButton: ConfirmationButton = {
      label: `Cancel`,
      size: 'small',
      variant: 'outlined',
      click: (): void => this.dialogRef?.close(),
    };

    const options: ConfirmationOptions = {
      title: 'Deleting Node',
      message: `Do you really want to delete <span class="font-bold font-stretch-semi-expanded">${selectedNode.name}</span>? <br />
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

  protected async handleSave(): Promise<void> {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    const workingName: string | null = this.workingName();
    if (!selectedId || !workingName) return;

    const transformedName: string = Transformer.toPascalName(workingName);
    const patch: UpdateNodeInput = { name: transformedName };
    await this.workspace.actions.updateNode(selectedId, patch);

    this.isWorkingNameActive.set(false);
  }
}
