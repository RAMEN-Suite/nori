import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  Injector,
  afterNextRender,
  afterEveryRender,
  inject,
  signal,
  type Signal,
  type WritableSignal,
  output,
  type OutputEmitterRef,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { FormsModule } from '@angular/forms';
import {
  Button,
  Input,
  List,
  ListItemTemplate,
  Tooltip,
  Accordion,
  AccordionItem,
  AccordionHeaderTemplate,
  AccordionIndicatorTemplate,
  type ListTrackBy,
  type NavbarItem,
} from '@sushi-kit/angular';
import { LucidePlus, LucideX, LucideCopy, LucideTrash, LucideBox, LucideChevronRight } from '@lucide/angular';
import { NodeEditingService } from '../../../services/workspace/node-editing.service';
import { ModelRef, type Node } from '@ramen-suite/core/model';
import { type NodeLevel } from '../../../services/workspace/workspace.view';
import { StorageService } from '../../../services/storage.service';
import { WorkspaceService } from '../../../services/workspace/workspace.service';
import { NavigationService } from '../../../services/navigation.service';
import { AutoselectDirective } from '../../../directives/autoselect.directive';
import { Transformer } from '../../../core/helper/Transformer';
import { ApplicationState } from '../../../states/application.state';

type NodeItem = NavbarItem<string>;

interface NodeGroup {
  readonly label: string;
  readonly items: readonly NodeItem[];
  readonly baseNodeRef: string | null;
}

@Component({
  selector: 'app-side-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoDirective,
    FormsModule,
    Button,
    Input,
    List,
    ListItemTemplate,
    Tooltip,
    Accordion,
    AccordionItem,
    AccordionHeaderTemplate,
    AccordionIndicatorTemplate,
    LucideBox,
    LucideChevronRight,
    LucideCopy,
    LucideTrash,
    LucidePlus,
    AutoselectDirective,
    LucideX,
  ],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
})
export class SideMenuComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly nodeEditing: NodeEditingService = inject(NodeEditingService);
  protected readonly trackNode: ListTrackBy<NodeItem> = (_index: number, item: NodeItem): string => item.value;
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector: Injector = inject(Injector);
  private readonly storage: StorageService = inject(StorageService);
  private readonly navigation: NavigationService = inject(NavigationService);

  public readonly closePanel: OutputEmitterRef<void> = output();
  public readonly nodeSelected: OutputEmitterRef<void> = output();

  protected readonly collapsedGroups: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  protected readonly editingId: WritableSignal<string | null> = signal(null);
  protected readonly draftName: WritableSignal<string> = signal('');
  protected readonly savingName: WritableSignal<boolean> = signal(false);
  private editingModelId: string | undefined;
  private pendingRevealId: string | null = null;

  protected readonly search: WritableSignal<string> = signal('');
  protected readonly creating: WritableSignal<boolean> = signal(false);
  protected readonly isRefinementLevel: Signal<boolean> = computed((): boolean => this.workspace.store.currentSlot() > 0);
  protected readonly groups: Signal<readonly NodeGroup[]> = computed((): readonly NodeGroup[] =>
    this.groupLocalNodes(this.search().trim().toLowerCase()),
  );

  protected handleListKey(event: KeyboardEvent): void {
    if (event.key !== 'Tab') event.stopPropagation();
  }

  protected handleGroupTab(event: Event): void {
    if (!(event instanceof KeyboardEvent) || !(event.currentTarget instanceof HTMLElement)) return;

    const group: HTMLElement = event.currentTarget;
    const add: HTMLButtonElement | null = group.querySelector('.node-group-add:not(:disabled)');
    const header: HTMLButtonElement | null = group.querySelector('button[aria-expanded]');
    const first: HTMLButtonElement | null = group.querySelector('.editor-list-entry');
    if (!header) return;

    const expanded: boolean = header.getAttribute('aria-expanded') === 'true';
    let next: HTMLButtonElement | null = null;
    if (event.target === header && !event.shiftKey) next = add;
    else if (event.target === add) next = event.shiftKey ? header : expanded ? first : null;
    else if (event.target === first && event.shiftKey) next = add;
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

  protected async handleRefine(baseNodeId: string): Promise<void> {
    if (this.creating() || !this.workspace.view.editable()) return;
    const base: Node | undefined = this.workspace.store.getDraft().getNode(baseNodeId);
    if (!base) return;

    const names: Set<string> = new Set(this.workspace.view.currentNodes().map((node: Node): string => node.name));
    let name: string = base.name;
    let suffix: number = 2;
    while (names.has(name)) name = `${base.name}${suffix++}`;

    this.creating.set(true);
    const slot: number = this.workspace.store.currentSlot();
    const modelId: string | undefined = this.workspace.store.currentModel()?.id;
    try {
      const node: Node = await this.workspace.actions.createNode({ name, baseNodeId });
      if (this.workspace.store.currentModel()?.id !== modelId) return;
      this.search.set('');
      this.handleGroupExpansion(baseNodeId, [baseNodeId]);
      await this.navigation.navigateToNode(slot, node.id);
      this.pendingRevealId = node.id;
    } catch (error: unknown) {
      this.storage.reportError(error);
    } finally {
      this.creating.set(false);
    }
  }

  public constructor() {
    afterEveryRender((): void => this.revealPendingNode());
    effect((): void => {
      const modelId: string | undefined = this.workspace.store.currentModel()?.id;
      if (modelId !== this.editingModelId) this.editingId.set(null);
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
      this.handleCancelRename(restoreFocus);
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

  protected async handleSelect(id: string | number | null): Promise<void> {
    if (typeof id !== 'string') return;

    this.nodeSelected.emit();
    await this.navigation.navigateToNode(this.workspace.store.currentSlot(), id);
  }

  protected revealPendingNode(): void {
    const id: string | null = this.pendingRevealId;
    if (!id) return;
    if (this.workspace.store.currentNodeId() !== id) {
      this.pendingRevealId = null;
      return;
    }

    const buttons: NodeListOf<HTMLButtonElement> = this.element.nativeElement.querySelectorAll('button[data-node-id]');
    const button: HTMLButtonElement | undefined = [...buttons].find(
      (item: HTMLButtonElement): boolean => item.dataset['nodeId'] === id,
    );
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
    const grouped: Map<string, { label: string; items: NodeItem[]; baseNodeRef: string | null }> = new Map();
    const baseModelId: string | undefined = this.workspace.view.baseModel()?.id;
    for (const node of this.workspace.view.baseNodes()) {
      if (!baseModelId) continue;
      const reference: string = ModelRef.qualify(baseModelId, node.id);
      grouped.set(reference, { label: node.name, items: [], baseNodeRef: reference });
    }
    for (const node of this.workspace.view.currentNodes()) {
      const base: NodeLevel | null = this.workspace.view.resolveNodeBase(node);
      const label: string = base?.node.name ?? this.workspace.store.currentModel()?.name ?? '';

      const key: string = base ? ModelRef.qualify(base.modelId, base.node.id) : '';
      const group: { label: string; items: NodeItem[]; baseNodeRef: string | null } = grouped.get(key) ?? {
        label,
        items: [],
        baseNodeRef: base ? ModelRef.qualify(base.modelId, base.node.id) : null,
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
