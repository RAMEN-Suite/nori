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
import { LucidePencil } from '@lucide/angular';
import { ModelRef, type Node } from '@ramen-suite/core/model';
import { Button, Chip, Input, Tooltip } from '@sushi-kit/angular';
import { Transformer } from '../../../../core/helper/Transformer';
import { AutoselectDirective } from '../../../../directives/autoselect.directive';
import { type ModelRecord } from '../../../../models/ModelRecord';
import { NavigationService } from '../../../../services/navigation.service';
import { StorageService } from '../../../../services/storage.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { type NodeLevel } from '../../../../services/workspace/workspace.view';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-basics',
  imports: [TranslocoDirective, Button, Chip, Input, Tooltip, FormsModule, AutoselectDirective, LucidePencil],
  templateUrl: './node-basics.component.html',
})
export class NodeBasicsComponent {
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly injector: Injector = inject(Injector);

  private readonly renameButton: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild('renameButton');

  protected readonly draftName: WritableSignal<string> = signal('');
  protected readonly savingName: WritableSignal<boolean> = signal(false);
  protected readonly editingName: WritableSignal<boolean> = signal(false);

  protected readonly base: Signal<NodeLevel | null> = computed((): NodeLevel | null => {
    const node: Node | null = this.workspace.view.currentNode();
    return node ? this.workspace.view.resolveNodeBase(node, this.workspace.view.nodeOwner()?.gmodel.id) : null;
  });

  protected readonly baseColour: Signal<string> = computed((): string => {
    const parent: Node | undefined = this.base()?.node;
    const colourId: string = parent ? ModelRef.localId(parent.superTypes[0] ?? parent.id) : '';
    return this.workspace.store.currentNodeColors()[colourId] ?? 'var(--color-base-content)';
  });

  public constructor() {
    effect((): void => {
      const currentName: string | undefined = this.workspace.view.currentNode()?.name;
      this.draftName.set(currentName ?? '');
      this.editingName.set(false);
    });
  }

  protected handleStartRename(): void {
    if (!this.workspace.view.nodeEditable() || this.savingName()) return;

    this.draftName.set(this.workspace.view.currentNode()?.name ?? '');
    this.editingName.set(true);
  }

  protected handleOpenNode(modelId: string, nodeId: string): void {
    const owner: ModelRecord | undefined = this.storage
      .records()
      .find((record: ModelRecord): boolean => record.gmodel.id === modelId);
    if (!owner) return;

    void this.navigation.navigateToNode(owner.slot, nodeId).catch((error: unknown): void => this.storage.reportError(error));
  }

  protected handleCancelRename(restoreFocus: boolean = true): void {
    this.editingName.set(false);
    if (restoreFocus) afterNextRender((): void => this.renameButton()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async handleSaveName(restoreFocus: boolean = false): Promise<void> {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    const name: string = this.draftName().trim();
    if (!this.editingName() || !selectedId || this.savingName() || !this.workspace.view.nodeEditable()) return;
    if (!name) {
      this.handleCancelRename(restoreFocus);
      return;
    }

    const transformedName: string = Transformer.toPascalName(name);

    this.savingName.set(true);
    try {
      await this.workspace.actions.updateNode(selectedId, { name: transformedName });
      if (this.workspace.store.currentNodeId() === selectedId) this.handleCancelRename(restoreFocus);
    } catch (error: unknown) {
      this.storage.reportError(error);
    } finally {
      this.savingName.set(false);
    }
  }
}
