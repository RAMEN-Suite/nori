import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideChevronRight, LucideGitBranch, LucideTrash, LucidePlus } from '@lucide/angular';
import { type NodeSuggestion, type Relation } from '@ramen-suite/core/model';
import {
  Accordion,
  AccordionHeaderTemplate,
  AccordionIndicatorTemplate,
  AccordionItem,
  Button,
  Input,
  List,
  ListItemTemplate,
  Tooltip,
  type ListTrackBy,
} from '@sushi-kit/angular';
import { type ModelRecord } from '../../../models/ModelRecord';
import { NavigationService } from '../../../services/navigation.service';
import { StorageService } from '../../../services/storage.service';
import { NodeEditingService } from '../../../services/workspace/node-editing.service';
import { WorkspaceService } from '../../../services/workspace/workspace.service';

interface BaseNodeGroup {
  readonly record: ModelRecord;
  readonly nodes: readonly NodeSuggestion[];
}

@Component({
  selector: 'app-base-nodes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslocoDirective,
    Accordion,
    AccordionItem,
    AccordionHeaderTemplate,
    AccordionIndicatorTemplate,
    Button,
    Input,
    List,
    ListItemTemplate,
    Tooltip,
    LucideChevronRight,
    LucideGitBranch,
    LucideTrash,
    LucidePlus,
  ],
  templateUrl: './base-nodes.component.html',
  styleUrl: './base-nodes.component.scss',
})
export class BaseNodesComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly nodeEditing: NodeEditingService = inject(NodeEditingService);
  private readonly storage: StorageService = inject(StorageService);
  private readonly navigation: NavigationService = inject(NavigationService);

  public readonly nodeSelected: OutputEmitterRef<void> = output();

  protected readonly search: WritableSignal<string> = signal('');
  protected readonly collapsedGroups: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  protected readonly pending: WritableSignal<boolean> = signal(false);
  protected readonly trackNode: ListTrackBy<NodeSuggestion> = (_index: number, node: NodeSuggestion): string => node.ref;
  protected readonly visible: Signal<ReadonlySet<string>> = computed(
    (): ReadonlySet<string> =>
      new Set([
        ...(this.workspace.store.currentModelRecord()?.view?.visibleNodeRefs ?? []),
        ...this.workspace.view
          .currentRelations()
          .flatMap((relation: Relation): string[] => [relation.from.nodeId, relation.to.nodeId]),
      ]),
  );
  protected readonly groups: Signal<readonly BaseNodeGroup[]> = computed((): readonly BaseNodeGroup[] => {
    const query: string = this.search().trim().toLowerCase();
    const suggestions: readonly NodeSuggestion[] = this.workspace.view.nodeSuggestions();
    return [...this.storage.records()]
      .sort((left: ModelRecord, right: ModelRecord): number => right.slot - left.slot)
      .filter((record: ModelRecord): boolean => record.gmodel.id !== this.workspace.store.currentModel()?.id)
      .map(
        (record: ModelRecord): BaseNodeGroup => ({
          record,
          nodes: suggestions.filter(
            (node: NodeSuggestion): boolean =>
              node.modelId === record.gmodel.id && `${node.name} ${record.name}`.toLowerCase().includes(query),
          ),
        }),
      )
      .filter((group: BaseNodeGroup): boolean => group.nodes.length > 0);
  });

  protected handleListKey(event: KeyboardEvent): void {
    const undo: boolean = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z';
    if (event.key !== 'Tab' && event.key !== 'Escape' && !undo) event.stopPropagation();
  }

  protected handleGroupExpansion(key: string, expanded: readonly string[]): void {
    this.collapsedGroups.update((current: ReadonlySet<string>): ReadonlySet<string> => {
      const next: Set<string> = new Set(current);
      if (expanded.length) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected async handleSelect(reference: string): Promise<void> {
    try {
      await this.navigation.navigateToNode(this.workspace.store.currentSlot(), reference);
      this.nodeSelected.emit();
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }

  protected async handleVisibility(reference: string): Promise<void> {
    if (this.pending()) return;
    if (this.visible().has(reference)) {
      this.nodeEditing.confirmCanvasRemoval(reference);
      return;
    }

    const modelId: string | undefined = this.workspace.store.currentModel()?.id;

    this.pending.set(true);
    try {
      await this.workspace.actions.addVisibleNode(reference);
      if (this.workspace.store.currentModel()?.id !== modelId) return;

      await this.handleSelect(reference);
    } catch (error: unknown) {
      this.storage.reportError(error);
    } finally {
      this.pending.set(false);
    }
  }
}
