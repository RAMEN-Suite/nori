import { Component, DestroyRef, effect, inject, signal, WritableSignal } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { NodeBasicsComponent } from './node-basics/node-basics.component';
import { GNode } from '../../../../core/models/GModel';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { ScrollPanel } from 'primeng/scrollpanel';
import { NodeAttributesComponent } from './node-attributes/node-attributes.component';
import { NodeRelationsComponent } from './node-relations/node-relations.component';
import { PatchNode } from '../../../../core/handler/GModelMutations';
import { CanDeactivate } from '../../../../guards/workspace.guard';
import { ActivatedRoute } from '@angular/router';
import { NavigationService } from '../../../../services/navigation.service';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  ConfirmationButton,
  ConfirmationDialog,
  ConfirmationOptions,
} from '../../dialogs/confirmation/confirmation.dialog';

@Component({
  selector: 'app-node-editor',
  imports: [
    FormsModule,
    Button,
    NodeBasicsComponent,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    ScrollPanel,
    NodeAttributesComponent,
    NodeRelationsComponent,
  ],
  providers: [DialogService, DynamicDialogRef],
  templateUrl: './node-view.component.html',
  styleUrl: './node-view.component.scss',
})
export class NodeViewComponent implements CanDeactivate {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly navigation: NavigationService = inject(NavigationService);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

  protected readonly draftNode: WritableSignal<PatchNode> = signal({});
  protected readonly isDraftDirty: WritableSignal<boolean> = signal(false);

  protected currentId: string | null = null;

  constructor() {
    effect((): void => {
      const selectedId: string | null = this.workspace.store.selectedNodeId();
      if (!selectedId || selectedId === this.currentId) return;
      this.handleResetView();
    });

    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  public async ngCanDeactivate(): Promise<boolean> {
    if (!this.isDraftDirty()) return Promise.resolve(true);

    const isNodeDeleted: boolean = !this.workspace.view.workNodesById().has(this.currentId || '');
    if (isNodeDeleted) return Promise.resolve(true);

    return new Promise<boolean>((resolve): void => {
      this.dialogRef?.close();

      const saveButton: ConfirmationButton = {
        label: 'Save Changes',
        size: 'small',
        click: async (): Promise<void> => {
          await this.handleSaveView();
          this.dialogRef?.close();
          return resolve(true);
        },
      };
      const cancelButton: ConfirmationButton = {
        label: `Cancel`,
        size: 'small',
        variant: 'outlined',
        click: (): void => {
          this.dialogRef?.close();
          return resolve(false);
        },
      };
      const discardButton: ConfirmationButton = {
        label: `Don't Save Changes`,
        size: 'small',
        variant: 'outlined',
        click: (): void => {
          this.dialogRef?.close();
          resolve(true);
        },
      };

      const options: ConfirmationOptions = {
        title: 'You have unsaved changes',
        message: `Do you want to save changes you have made in
        <span class="font-bold font-stretch-semi-expanded">${this.draftNode().name}</span> before leaving?
        Your changes will be lost if you don't save them.`,
        icon: 'pi-pen-to-square',
        justify: 'justify-around',
        buttons: [[discardButton], [cancelButton, saveButton]],
      };

      this.dialogRef = this.dialogService.open(ConfirmationDialog, {
        showHeader: false,
        closeOnEscape: true,
        dismissableMask: true,
        closable: true,
        inputValues: { options },
      });
    });
  }

  protected handleCloseView(): void {
    const selectedSlot: number = this.workspace.store.selectedSlot();
    void this.navigation.navigateToSlot(this.activatedRoute, selectedSlot);
  }

  protected async handleSaveView(): Promise<void> {
    const selectedNodeId: string | null = this.workspace.store.selectedNodeId();
    if (!selectedNodeId) return;

    await this.workspace.actions.updateNode(selectedNodeId, this.draftNode());
    this.isDraftDirty.set(false);
  }

  protected handleResetView(): void {
    const selectedNode: GNode | null = this.workspace.view.selectedWorkNode();
    if (!selectedNode) return;

    this.draftNode.set({
      name: selectedNode.name,
      attributes: structuredClone(selectedNode.attributes),
      superTypes: structuredClone(selectedNode.superTypes),
    });

    this.currentId = selectedNode.id;
    this.isDraftDirty.set(false);
  }
}
