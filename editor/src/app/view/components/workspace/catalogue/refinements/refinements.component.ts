import {
  afterEveryRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  type OutputEmitterRef,
  signal,
  linkedSignal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideBox, LucideChevronRight, LucideCopy, LucidePlus, LucideTrash } from '@lucide/angular';
import { ModelRef } from '@ramen-suite/core/model';
import {
  Accordion,
  AccordionActionsTemplate,
  AccordionHeaderTemplate,
  AccordionIndicatorTemplate,
  AccordionItem,
  Button,
  Input,
  List,
  ListItemTemplate,
  type ListTrackBy,
} from '@sushi-kit/angular';
import { toPascalName } from '../../../../../utils/model-names';
import { InlineRename } from '../../../shared/inline-name-input/inline-rename';
import { InlineNameInputComponent } from '../../../shared/inline-name-input/inline-name-input.component';
import { ScrollOverflowDirective } from '../../../../../directives/scroll-overflow.directive';
import { IconTooltipDirective, TooltipDirective } from '../../../../../directives/tooltip.directive';
import { NavigationService } from '../../../../../services/interaction/navigation.service';
import { ProjectService } from '../../../../../services/projects/project.service';
import { NodeEditingService, type CreatedRefinement } from '../../../../../services/workspace/editing/node-editing.service';
import { updateSetMembership } from '../../../../../utils/collections';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { type NodeDefinition } from '../../../../../models/WorkspaceDetails';
import { ApplicationState } from '../../../../../states/application.state';
import { ScrollHintsComponent } from '../../../shared/scroll-hints/scroll-hints.component';

interface NodeItem {
  readonly value: string;
  readonly label: string;
}

interface NodeGroup {
  readonly label: string;
  readonly items: readonly NodeItem[];
  readonly baseNodeRef: string | null;
}

interface MutableNodeGroup extends Omit<NodeGroup, 'items'> {
  readonly items: NodeItem[];
}

@Component({
  selector: 'nori-refinements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollOverflowDirective,
    ScrollHintsComponent,
    TranslocoDirective,
    FormsModule,
    Button,
    Input,
    List,
    ListItemTemplate,
    IconTooltipDirective,
    TooltipDirective,
    Accordion,
    AccordionItem,
    AccordionActionsTemplate,
    AccordionHeaderTemplate,
    AccordionIndicatorTemplate,
    LucideBox,
    LucideChevronRight,
    LucideCopy,
    LucideTrash,
    LucidePlus,
    InlineNameInputComponent,
  ],
  templateUrl: './refinements.component.html',
  styleUrl: './refinements.component.scss',
})
export class RefinementsComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly nodeEditing: NodeEditingService = inject(NodeEditingService);
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly navigation: NavigationService = inject(NavigationService);

  public readonly nodeSelected: OutputEmitterRef<void> = output();

  protected readonly trackNode: ListTrackBy<NodeItem> = (_index: number, item: NodeItem): string => item.value;
  protected readonly collapsedGroups: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  private readonly renameContext: Signal<string> = computed((): string => JSON.stringify(this.workspace.context()));
  protected readonly editingId: WritableSignal<string | null> = linkedSignal({
    source: this.renameContext,
    computation: (): string | null => null,
  });
  protected readonly rename: InlineRename<string> = new InlineRename(this.editingId, this.renameContext, (error: unknown): void =>
    this.projects.reportError(error),
  );
  private readonly pendingRevealId: WritableSignal<string | null> = signal(null);
  protected readonly search: WritableSignal<string> = signal('');

  protected readonly isRefinementLevel: Signal<boolean> = computed((): boolean => this.workspace.store.currentLevelIndex() > 0);
  protected readonly groups: Signal<readonly NodeGroup[]> = computed((): readonly NodeGroup[] =>
    this.groupLocalNodes(this.search().trim().toLowerCase()),
  );

  public constructor() {
    afterEveryRender((): void => this.revealPendingNode());
    this.nodeEditing.createdRefinement.pipe(takeUntilDestroyed()).subscribe((created: CreatedRefinement): void => {
      if (created.modelId !== this.workspace.store.currentModel()?.id) return;

      this.search.set('');
      this.handleGroupExpansion(created.baseNodeId, [created.baseNodeId]);
      this.handleRename({ value: created.node.id, label: created.node.name });
      this.pendingRevealId.set(created.node.id);
    });
  }

  protected handleGroupExpansion(key: string, expanded: readonly string[]): void {
    this.collapsedGroups.update((current: ReadonlySet<string>): ReadonlySet<string> =>
      updateSetMembership(current, key, expanded.length === 0),
    );
  }

  protected handleRename(item: NodeItem): void {
    if (!this.workspace.queries.isEditable() || this.rename.isSaving()) return;

    this.rename.start(item.value, item.label);
  }

  protected handleSaveName(restoreFocus: boolean = false): Promise<void> {
    return this.rename.save(
      (id: string, name: string): Promise<unknown> => this.workspace.actions.updateNode(id, { name: toPascalName(name) }),
      (): void => this.handleCancelRename(restoreFocus),
    );
  }

  protected handleCancelRename(restoreFocus: boolean = false): void {
    const id: string | null = this.rename.cancel();
    if (!restoreFocus || !id) return;
    this.rename.restoreFocus((): HTMLButtonElement | null =>
      this.element.nativeElement.querySelector(`button[data-node-id="${CSS.escape(id)}"]`),
    );
  }

  protected async handleSelect(id: string): Promise<void> {
    try {
      await this.navigation.navigateToNode(this.workspace.store.currentLevelIndex(), id);
      this.nodeSelected.emit();
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  private revealPendingNode(): void {
    const id: string | null = this.pendingRevealId();
    if (!id) return;
    if (this.workspace.store.currentNodeId() !== id) {
      this.pendingRevealId.set(null);
      return;
    }

    const entries: NodeListOf<HTMLElement> = this.element.nativeElement.querySelectorAll('[data-node-id]');
    const button: HTMLElement | undefined = [...entries].find((item: HTMLElement): boolean => item.dataset['nodeId'] === id);
    if (!button) return;
    const catalogue: HTMLElement | null = this.element.nativeElement.querySelector('.node-catalogue');
    const bounds: DOMRect | undefined = catalogue?.getBoundingClientRect();
    const item: DOMRect = button.getBoundingClientRect();
    if (bounds && item.top >= bounds.top && item.bottom <= bounds.bottom) {
      this.pendingRevealId.set(null);
      return;
    }
    button.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: this.appearance.isMotionEnabled() ? 'smooth' : 'instant',
    });
  }

  private groupLocalNodes(query: string): NodeGroup[] {
    const grouped: Map<string, MutableNodeGroup> = new Map();
    const baseModelId: string | undefined = this.workspace.queries.baseModel()?.id;

    if (baseModelId) {
      for (const node of this.workspace.queries.baseNodes()) {
        const ref: string = ModelRef.qualify(baseModelId, node.id);
        grouped.set(ref, { label: node.name, items: [], baseNodeRef: ref });
      }
    }

    for (const node of this.workspace.queries.currentNodes()) {
      const base: NodeDefinition | null = this.workspace.queries.resolveNodeBase(node);
      const label: string = base?.node.name ?? this.workspace.store.currentModel()?.name ?? '';

      const key: string = base ? ModelRef.qualify(base.modelId, base.node.id) : '';
      const group: MutableNodeGroup = grouped.get(key) ?? {
        label,
        items: [],
        baseNodeRef: key || null,
      };
      group.items.push({ value: node.id, label: node.name });
      grouped.set(key, group);
    }

    return [...grouped.values()]
      .map((group): NodeGroup => ({
        ...group,
        items: group.items.filter((item: NodeItem): boolean => `${item.label} ${group.label}`.toLowerCase().includes(query)),
      }))
      .filter((group: NodeGroup): boolean => !query || group.items.length > 0 || group.label.toLowerCase().includes(query))
      .sort((left, right): number => left.label.localeCompare(right.label));
  }
}
