import { LucidePencil, LucideTrash, LucideCopy, LucideGitBranch, LucideChevronRight } from '@lucide/angular';
import { Node, UpdateNodeInput, type NodeSuggestion } from '@ramen-suite/core/model';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  WritableSignal,
  ChangeDetectionStrategy,
  computed,
  type Signal,
} from '@angular/core';
import { Button, Input, Tooltip } from '@sushi-kit/angular';

import { TranslocoDirective } from '@jsverse/transloco';
import { CreateNodeDialog } from '../../dialogs/create-node/create-node.dialog';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../../../services/storage.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';

import { DialogService, DialogRef } from '../../../../services/dialog.service';
import { NodeColorsDialog } from '../../dialogs/node-colors/node-colors.dialog';
import { NavigationService } from '../../../../services/navigation.service';
import { NodeEditingService } from '../../../../services/workspace/node-editing.service';

import { Transformer } from '../../../../core/helper/Transformer';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-basics',
  imports: [
    TranslocoDirective,
    LucideChevronRight,
    Button,
    Input,
    Tooltip,
    FormsModule,
    LucidePencil,
    LucideTrash,
    LucideCopy,
    LucideGitBranch,
  ],
  templateUrl: './node-basics.component.html',
  styleUrl: './node-basics.component.scss',
})
export class NodeBasicsComponent {
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly navigation: NavigationService = inject(NavigationService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DialogRef | null = null;

  private readonly nodeEditing: NodeEditingService = inject(NodeEditingService);

  protected readonly workingName: WritableSignal<string | null> = signal(null);
  protected readonly isWorkingNameActive: WritableSignal<boolean> = signal(false);

  protected readonly refinement: Signal<NodeSuggestion | undefined> = computed((): NodeSuggestion | undefined => {
    const node: Node | null = this.workspace.view.currentNode();
    return this.workspace.view
      .nodeSuggestions()
      .find(
        (suggestion: NodeSuggestion): boolean =>
          suggestion.nodeId === node?.id && suggestion.modelId === this.workspace.store.currentModel()?.id,
      );
  });

  protected handleRefine(): void {
    const suggestion: NodeSuggestion | undefined = this.refinement();
    if (!suggestion) return;

    this.dialogService.open(CreateNodeDialog, {
      headerKey: 'editor.refineNode',
      inputValues: { baseNodeId: suggestion.ref },
    });
  }

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
    await this.nodeEditing.duplicate(selectedId);
  }

  protected handleDeleteNode(): void {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    if (selectedId) this.nodeEditing.confirmRemoval(selectedId);
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
