import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideChevronRight, LucideCopy, LucideGitBranch, LucidePencil, LucideTrash } from '@lucide/angular';
import { type Node, type NodeSuggestion, type UpdateNodeInput } from '@ramen-suite/core/model';
import { Button, Input, Tooltip } from '@sushi-kit/angular';
import { Transformer } from '../../../../core/helper/Transformer';
import { type ModelRecord } from '../../../../models/ModelRecord';
import { NavigationService } from '../../../../services/navigation.service';
import { StorageService } from '../../../../services/storage.service';
import { NodeEditingService } from '../../../../services/workspace/node-editing.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';

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
  private readonly nodeEditing: NodeEditingService = inject(NodeEditingService);

  protected readonly workingName: WritableSignal<string | null> = signal(null);
  protected readonly isWorkingNameActive: WritableSignal<boolean> = signal(false);

  protected readonly refinement: Signal<NodeSuggestion | undefined> = computed((): NodeSuggestion | undefined => {
    const node: Node | null = this.workspace.view.currentNode();
    return this.workspace.view
      .nodeSuggestions()
      .find(
        (suggestion: NodeSuggestion): boolean =>
          suggestion.nodeId === node?.id && suggestion.modelId === this.workspace.view.nodeOwner()?.gmodel.id,
      );
  });

  public constructor() {
    effect((): void => {
      const currentName: string | undefined = this.workspace.view.currentNode()?.name;
      this.workingName.set(currentName ?? null);
    });
  }

  protected handleOpenOrigin(): void {
    const owner: ModelRecord | null = this.workspace.view.nodeOwner();
    const node: Node | null = this.workspace.view.currentNode();
    if (!owner || !node) return;

    void this.navigation.navigateToNode(owner.slot, node.id).catch((error: unknown): void => this.storage.reportError(error));
  }

  protected handleRefine(): void {
    const suggestion: NodeSuggestion | undefined = this.refinement();
    if (!suggestion) return;

    void this.nodeEditing.refine(suggestion.ref);
  }

  protected async handleDuplicateNode(): Promise<void> {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    if (!selectedId) return;
    await this.nodeEditing.duplicate(selectedId);
  }

  protected handleRemoveNode(): void {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    if (selectedId) this.nodeEditing.confirmRemoval(selectedId);
  }

  protected async handleSave(): Promise<void> {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    const workingName: string | null = this.workingName();
    if (!selectedId || !workingName || !this.workspace.view.nodeEditable()) return;

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
