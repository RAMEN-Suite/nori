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
import { LucideBox, LucideChevronRight, LucideGitBranch, LucideTrash, LucidePlus } from '@lucide/angular';
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
  type ListTrackBy,
} from '@sushi-kit/angular';
import { ScrollOverflowDirective } from '../../../../../directives/scroll-overflow.directive';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';
import { type ModelRecord } from '../../../../../models/ModelRecord';
import { NavigationService } from '../../../../../services/interaction/navigation.service';
import { ProjectService } from '../../../../../services/projects/project.service';
import { NodeEditingService } from '../../../../../services/workspace/editing/node-editing.service';
import { updateSetMembership } from '../../../../../utils/collections';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { ScrollHintsComponent } from '../../../shared/scroll-hints/scroll-hints.component';

interface BaseNodeGroup {
  readonly record: ModelRecord;
  readonly nodes: readonly NodeSuggestion[];
}

@Component({
  selector: 'nori-base-nodes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollOverflowDirective,
    ScrollHintsComponent,
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
    TooltipDirective,
    LucideBox,
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
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly navigation: NavigationService = inject(NavigationService);

  public readonly nodeSelected: OutputEmitterRef<void> = output();

  protected readonly search: WritableSignal<string> = signal('');
  protected readonly collapsedGroups: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  protected readonly isPending: WritableSignal<boolean> = signal(false);
  protected readonly trackNode: ListTrackBy<NodeSuggestion> = (_index: number, node: NodeSuggestion): string => node.ref;

  protected readonly visible: Signal<ReadonlySet<string>> = computed(
    (): ReadonlySet<string> =>
      new Set([
        ...(this.workspace.store.currentModelRecord()?.view?.visibleNodeRefs ?? []),
        ...this.workspace.queries
          .currentRelations()
          .flatMap((relation: Relation): string[] => [relation.from.nodeId, relation.to.nodeId]),
      ]),
  );
  protected readonly groups: Signal<readonly BaseNodeGroup[]> = computed((): readonly BaseNodeGroup[] => {
    const query: string = this.search().trim().toLowerCase();
    const suggestions: readonly NodeSuggestion[] = this.workspace.queries.nodeSuggestions();
    return [...this.projects.records()]
      .sort((left: ModelRecord, right: ModelRecord): number => right.levelIndex - left.levelIndex)
      .filter((record: ModelRecord): boolean => record.gmodel.id !== this.workspace.store.currentModel()?.id)
      .map((record: ModelRecord): BaseNodeGroup => ({
        record,
        nodes: suggestions.filter(
          (node: NodeSuggestion): boolean =>
            node.modelId === record.gmodel.id && `${node.name} ${record.name}`.toLowerCase().includes(query),
        ),
      }))
      .filter((group: BaseNodeGroup): boolean => group.nodes.length > 0);
  });

  protected handleGroupExpansion(key: string, expanded: readonly string[]): void {
    this.collapsedGroups.update((current: ReadonlySet<string>): ReadonlySet<string> =>
      updateSetMembership(current, key, expanded.length === 0),
    );
  }

  protected async handleSelect(reference: string): Promise<void> {
    try {
      await this.navigation.navigateToNode(this.workspace.store.currentLevelIndex(), reference);
      this.nodeSelected.emit();
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  protected async handleVisibility(reference: string): Promise<void> {
    if (this.isPending()) return;
    if (this.visible().has(reference)) {
      this.nodeEditing.confirmCanvasRemoval(reference);
      return;
    }

    const modelId: string | undefined = this.workspace.store.currentModel()?.id;

    this.isPending.set(true);
    try {
      await this.workspace.actions.addVisibleNode(reference);
      if (this.workspace.store.currentModel()?.id !== modelId) return;

      await this.handleSelect(reference);
    } catch (error: unknown) {
      this.projects.reportError(error);
    } finally {
      this.isPending.set(false);
    }
  }
}
