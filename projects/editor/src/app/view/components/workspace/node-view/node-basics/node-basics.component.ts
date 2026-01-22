import { Component, DestroyRef, effect, inject, model, ModelSignal, signal, WritableSignal } from '@angular/core';
import { Button } from 'primeng/button';
import { Chip } from 'primeng/chip';
import { Inplace } from 'primeng/inplace';
import { InputText } from 'primeng/inputtext';
import { Panel } from 'primeng/panel';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Tooltip } from 'primeng/tooltip';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { NgStyle } from '@angular/common';
import { ConfirmationService } from 'primeng/api';
import { GNode } from '../../../../../core/models/GModel';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { NodeColorsDialog } from '../../../dialogs/node-colors/node-colors.dialog';
import { AutoFocus } from 'primeng/autofocus';
import { PatchNode } from '../../../../../core/handler/GModelMutations';
import { NavigationService } from '../../../../../services/navigation.service';
import { ActivatedRoute } from '@angular/router';

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
    ConfirmDialog,
    AutoFocus,
  ],
  providers: [ConfirmationService, DialogService, DynamicDialogRef],
  templateUrl: './node-basics.component.html',
  styleUrl: './node-basics.component.scss',
})
export class NodeBasicsComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly confirmation: ConfirmationService = inject(ConfirmationService);

  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  protected readonly navigation: NavigationService = inject(NavigationService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

  protected readonly isNameActive: WritableSignal<boolean> = signal(false);

  public isDraftDirty: ModelSignal<boolean | undefined> = model();
  public draftNode: ModelSignal<PatchNode> = model({});

  constructor() {
    effect((): void => {
      this.workspace.store.selectedNodeId();
      this.isNameActive.set(false);
    });

    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected handleEditNodeName(): void {
    this.isNameActive.set(!this.isNameActive());
    this.isDraftDirty.set(true);
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
    const selectedId: string | null = this.workspace.store.selectedNodeId();
    if (!selectedId) return;
    await this.workspace.actions.duplicateNode(selectedId);
  }

  protected async handleDeleteNode(): Promise<void> {
    const selectedNode: GNode | null = this.workspace.view.selectedWorkNode();
    if (!selectedNode) return;

    this.confirmation.confirm({
      message: `Do you really want to delete "${selectedNode.name}"?`,
      header: 'Delete Node',
      key: 'node-basics',
      dismissableMask: true,
      rejectButtonProps: {
        label: 'Cancel',
        size: 'small',
        variant: 'outlined',
      },
      acceptButtonProps: {
        label: 'Yes, I want to delete my node',
        size: 'small',
        variant: 'outlined',
        severity: 'danger',
      },
      accept: async (): Promise<void> => {
        if (!selectedNode.id) return;

        await this.workspace.actions.deleteNode(selectedNode.id);
        const selectedSlot: number | null = this.workspace.store.selectedSlot();
        void this.navigation.navigateToSlot(this.activatedRoute, selectedSlot);
      },
    });
  }
}
