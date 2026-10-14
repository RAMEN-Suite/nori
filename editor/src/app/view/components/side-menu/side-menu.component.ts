import {
  afterEveryRender,
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  output,
  type OutputEmitterRef,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideChevronRight, LucideCopy, LucidePlus, LucideTrash } from '@lucide/angular';
import { ModelRef, type Node } from '@ramen-suite/core/model';
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
import { Transformer } from '../../../core/helper/Transformer';
import { AutoselectDirective } from '../../../directives/autoselect.directive';
import { ScrollOverflowDirective } from '../../../directives/scroll-overflow.directive';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { NavigationService } from '../../../services/navigation.service';
import { StorageService } from '../../../services/storage.service';
import { NodeEditingService } from '../../../services/workspace/node-editing.service';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { type NodeLevel } from '../../../services/workspace/workspace.view';
import { ApplicationState } from '../../../states/application.state';
import { ScrollHintsComponent } from '../scroll-hints/scroll-hints.component';

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
  selector: 'nori-side-menu',
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
    TooltipDirective,
    Accordion,
    AccordionItem,
    AccordionHeaderTemplate,
    AccordionIndicatorTemplate,
    LucideChevronRight,
    LucideCopy,
    LucideTrash,
    LucidePlus,
    AutoselectDirective,
  ],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
})
export class SideMenuComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly nodeEditing: NodeEditingService = inject(NodeEditingService);
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector: Injector = inject(Injector);
  private readonly storage: StorageService = inject(StorageService);
  private readonly navigation: NavigationService = inject(NavigationService);

  public readonly nodeSelected: OutputEmitterRef<void> = output();

  protected readonly trackNode: ListTrackBy<NodeItem> = (_index: number, item: NodeItem): string => item.value;
  protected readonly collapsedGroups: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  protected readonly editingId: WritableSignal<string | null> = signal(null);
  protected readonly draftName: WritableSignal<string> = signal('');
  protected readonly savingName: WritableSignal<boolean> = signal(false);
  private editingModelId: string | undefined;
  private pendingRevealId: string | null = null;
  protected readonly search: WritableSignal<string> = signal('');

  protected readonly isRefinementLevel: Signal<boolean> = computed((): boolean => this.workspace.store.currentSlot() > 0);
  protected readonly groups: Signal<readonly NodeGroup[]> = computed((): readonly NodeGroup[] =>
    this.groupLocalNodes(this.search().trim().toLowerCase()),
  );

  public constructor() {
    afterEveryRender((): void => this.revealPendingNode());
    effect((): void => {
      const created: { modelId: string; baseNodeId: string; node: Node } | null = this.nodeEditing.createdRefinement();
      if (!created || created.modelId !== this.workspace.store.currentModel()?.id) return;

      this.search.set('');
      this.handleGroupExpansion(created.baseNodeId, [created.baseNodeId]);
      this.handleRename({ value: created.node.id, label: created.node.name });
      this.pendingRevealId = created.node.id;
      this.nodeEditing.createdRefinement.set(null);
    });
    effect((): void => {
      const modelId: string | undefined = this.workspace.store.currentModel()?.id;
      if (modelId !== this.editingModelId) this.editingId.set(null);
    });
  }

  protected handleGroupTab(event: Event): void {
    if (!(event instanceof KeyboardEvent) || !(event.currentTarget instanceof HTMLElement)) return;

    const group: HTMLElement = event.currentTarget;
    const header: HTMLButtonElement | null = group.querySelector('button[aria-expanded]');
    const add: HTMLButtonElement | null = group.querySelector('.node-group-add:not(:disabled)');
    const first: HTMLElement | null =
      header?.getAttribute('aria-expanded') === 'true'
        ? group.querySelector('.editor-list-entry, .editor-name-editor input')
        : null;
    const order: HTMLElement[] = [header, add, first].filter((entry): entry is HTMLElement => !!entry);
    const index: number = order.findIndex((button: HTMLElement): boolean => button === event.target);
    if (index < 0 || (event.target === first && !event.shiftKey)) return;
    const next: HTMLElement | undefined = order[index + (event.shiftKey ? -1 : 1)];
    if (!next) return;

    event.preventDefault();
    next.focus();
  }

  protected handleGroupExpansion(key: string, expanded: readonly string[]): void {
    this.collapsedGroups.update((current: ReadonlySet<string>): ReadonlySet<string> => {
      const next: Set<string> = new Set(current);
      if (expanded.length) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected handleRename(item: NodeItem): void {
    if (!this.workspace.view.editable() || this.savingName()) return;

    this.editingModelId = this.workspace.store.currentModel()?.id;
    this.draftName.set(item.label);
    this.editingId.set(item.value);
  }

  protected async handleSaveName(restoreFocus: boolean = false): Promise<void> {
    const id: string | null = this.editingId();
    if (!id || this.savingName()) return;

    const name: string = this.draftName().trim();
    if (!name) {
      this.handleCancelRename(restoreFocus);
      return;
    }
    if (this.workspace.store.currentModel()?.id !== this.editingModelId) return;

    this.savingName.set(true);
    try {
      await this.workspace.actions.updateNode(id, { name: Transformer.toPascalName(name) });
      if (this.editingId() === id && this.workspace.store.currentModel()?.id === this.editingModelId) {
        this.handleCancelRename(restoreFocus);
      }
    } catch (error: unknown) {
      this.storage.reportError(error);
    } finally {
      this.savingName.set(false);
    }
  }

  protected handleCancelRename(restoreFocus: boolean = false): void {
    const id: string | null = this.editingId();
    this.editingId.set(null);
    if (!restoreFocus) return;

    afterNextRender(
      (): void => {
        const buttons: NodeListOf<HTMLButtonElement> = this.element.nativeElement.querySelectorAll('button[data-node-id]');
        [...buttons].find((button: HTMLButtonElement): boolean => button.dataset['nodeId'] === id)?.focus();
      },
      { injector: this.injector },
    );
  }

  protected async handleSelect(id: string): Promise<void> {
    try {
      await this.navigation.navigateToNode(this.workspace.store.currentSlot(), id);
      this.nodeSelected.emit();
    } catch (error: unknown) {
      this.storage.reportError(error);
    }
  }

  private revealPendingNode(): void {
    const id: string | null = this.pendingRevealId;
    if (!id) return;
    if (this.workspace.store.currentNodeId() !== id) {
      this.pendingRevealId = null;
      return;
    }

    const entries: NodeListOf<HTMLElement> = this.element.nativeElement.querySelectorAll('[data-node-id]');
    const button: HTMLElement | undefined = [...entries].find((item: HTMLElement): boolean => item.dataset['nodeId'] === id);
    if (!button) return; // Sushi instantiates collapsed content after its next render.
    const catalogue: HTMLElement | null = this.element.nativeElement.querySelector('.node-catalogue');
    const bounds: DOMRect | undefined = catalogue?.getBoundingClientRect();
    const item: DOMRect = button.getBoundingClientRect();
    if (bounds && item.top >= bounds.top && item.bottom <= bounds.bottom) {
      this.pendingRevealId = null;
      return;
    }
    button.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: this.appearance.state().animations ? 'smooth' : 'instant',
    });
  }

  private groupLocalNodes(query: string): NodeGroup[] {
    const grouped: Map<string, MutableNodeGroup> = new Map();
    const baseModelId: string | undefined = this.workspace.view.baseModel()?.id;

    if (baseModelId) {
      for (const node of this.workspace.view.baseNodes()) {
        const ref: string = ModelRef.qualify(baseModelId, node.id);
        grouped.set(ref, { label: node.name, items: [], baseNodeRef: ref });
      }
    }

    for (const node of this.workspace.view.currentNodes()) {
      const base: NodeLevel | null = this.workspace.view.resolveNodeBase(node);
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
      .map(
        (group): NodeGroup => ({
          ...group,
          items: group.items.filter((item: NodeItem): boolean => `${item.label} ${group.label}`.toLowerCase().includes(query)),
        }),
      )
      .filter((group: NodeGroup): boolean => !query || group.items.length > 0 || group.label.toLowerCase().includes(query))
      .sort((left, right): number => left.label.localeCompare(right.label));
  }
}
