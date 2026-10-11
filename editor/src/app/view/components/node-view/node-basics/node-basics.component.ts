import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCopy, LucideGitBranch, LucidePencil, LucideTrash } from '@lucide/angular';
import { ModelRef, type Node, type NodeSuggestion, type UpdateNodeInput } from '@ramen-suite/core/model';
import { Button, Chip, Input, Tooltip } from '@sushi-kit/angular';
import { Transformer } from '../../../../core/helper/Transformer';
import { AutoselectDirective } from '../../../../directives/autoselect.directive';
import { type ModelRecord } from '../../../../models/ModelRecord';
import { NavigationService } from '../../../../services/navigation.service';
import { StorageService } from '../../../../services/storage.service';
import { NodeEditingService } from '../../../../services/workspace/node-editing.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { type NodeLevel } from '../../../../services/workspace/workspace.view';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-basics',
  imports: [
    TranslocoDirective,
    Button,
    Chip,
    Input,
    Tooltip,
    FormsModule,
    AutoselectDirective,
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
  private readonly navigation: NavigationService = inject(NavigationService);
  protected readonly nodeEditing: NodeEditingService = inject(NodeEditingService);
  private readonly injector: Injector = inject(Injector);

  private readonly renameButton: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild('renameButton');

  protected readonly workingName: WritableSignal<string | null> = signal(null);
  protected readonly savingName: WritableSignal<boolean> = signal(false);
  protected readonly isWorkingNameActive: WritableSignal<boolean> = signal(false);

  protected readonly base: Signal<NodeLevel | null> = computed((): NodeLevel | null => {
    const node: Node | null = this.workspace.view.currentNode();
    return node ? this.workspace.view.resolveNodeBase(node, this.workspace.view.nodeOwner()?.gmodel.id) : null;
  });

  protected readonly baseColour: Signal<string> = computed((): string => {
    const parent: Node | undefined = this.base()?.node;
    const colourId: string = parent ? ModelRef.localId(parent.superTypes[0] ?? parent.id) : '';
    return this.workspace.store.currentNodeColors()[colourId] ?? 'var(--color-base-content)';
  });

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
      this.isWorkingNameActive.set(false);
    });
  }

  protected handleStartRename(): void {
    if (!this.workspace.view.nodeEditable() || this.savingName()) return;
    this.workingName.set(this.workspace.view.currentNode()?.name ?? null);
    this.isWorkingNameActive.set(true);
  }

  protected handleOpenNode(modelId: string, nodeId: string): void {
    const owner: ModelRecord | undefined = this.storage
      .records()
      .find((record: ModelRecord): boolean => record.gmodel.id === modelId);
    if (!owner) return;

    void this.navigation.navigateToNode(owner.slot, nodeId).catch((error: unknown): void => this.storage.reportError(error));
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

  protected handleCancelRename(restoreFocus: boolean = true): void {
    this.isWorkingNameActive.set(false);
    if (restoreFocus) afterNextRender((): void => this.renameButton()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async handleSave(restoreFocus: boolean = false): Promise<void> {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    const workingName: string | null = this.workingName();
    if (!this.isWorkingNameActive() || !selectedId || this.savingName() || !this.workspace.view.nodeEditable()) return;
    if (!workingName?.trim()) {
      this.handleCancelRename(restoreFocus);
      return;
    }

    const transformedName: string = Transformer.toPascalName(workingName.trim());
    const patch: UpdateNodeInput = { name: transformedName };

    this.savingName.set(true);
    try {
      await this.workspace.actions.updateNode(selectedId, patch);
      if (this.workspace.store.currentNodeId() === selectedId) this.handleCancelRename(restoreFocus);
    } catch (error: unknown) {
      this.storage.reportError(error);
    } finally {
      this.savingName.set(false);
    }
  }
}
