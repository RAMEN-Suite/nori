import {
  afterNextRender,
  Injector,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  DestroyRef,
  effect,
  computed,
  inject,
  output,
  signal,
  type Signal,
  type WritableSignal,
  type OutputEmitterRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideSettings2, LucideEraser, LucideEye, LucideArrowUpRight, LucideCopy, LucideList } from '@lucide/angular';
import {
  Button,
  Accordion,
  AccordionItem,
  AccordionHeaderTemplate,
  type AccordionValue,
  Input,
  OrderList,
  OrderListItemTemplate,
  type OrderListLabels,
  type OrderListReorderEvent,
  type AutocompleteOption,
} from '@sushi-kit/angular';
import { DataTypes, type Attribute, type UpdateAttributeInput } from '@ramen-suite/core/model';
import { WorkspaceService, type WorkspaceContext } from '../../../../../services/workspace/workspace.service';
import { ProjectService } from '../../../../../services/projects/project.service';
import { DialogService } from '../../../../../services/interaction/dialog.service';
import { PropertyEditingService } from '../../../../../services/workspace/editing/property-editing.service';
import type { InheritedAttribute } from '../../../../../models/WorkspaceDetails';
import { FieldValidationError } from '../../../../../models/FieldValidationError';
import { PropertyDetailsDialog } from '../../../dialogs/property-details/property-details.dialog';
import { ApplicationState } from '../../../../../states/application.state';
import { PropertyTypeComponent } from './property-type/property-type.component';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';

interface PropertyListItem {
  readonly label: string;
  readonly value: string;
  readonly attribute: Attribute;
}

@Component({
  selector: 'nori-property-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslocoDirective,
    Button,
    Accordion,
    AccordionItem,
    AccordionHeaderTemplate,
    Input,
    PropertyTypeComponent,
    OrderList,
    OrderListItemTemplate,
    LucideList,
    LucideSettings2,
    LucideEraser,
    LucideEye,
    LucideArrowUpRight,
    LucideCopy,
    TooltipDirective,
  ],
  templateUrl: './property-list.component.html',
  styleUrl: './property-list.component.scss',
})
export class PropertyListComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly editing: PropertyEditingService = inject(PropertyEditingService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly injector: Injector = inject(Injector);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly dialogs: DialogService = inject(DialogService);
  public readonly inspect: OutputEmitterRef<InheritedAttribute> = output();
  public readonly remove: OutputEmitterRef<Attribute> = output<Attribute>();
  public readonly duplicate: OutputEmitterRef<Attribute> = output<Attribute>();
  public readonly busy: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<{ id: string; field: string; message: string } | null> = signal(null);
  protected readonly drafts: WritableSignal<Readonly<Record<string, string>>> = signal({});
  protected readonly draft: Signal<{ id: string; name: string } | null> = computed(() => {
    const entry: [string, string] | undefined = Object.entries(this.drafts())[0];
    return entry ? { id: entry[0], name: entry[1] } : null;
  });
  protected readonly creating: WritableSignal<boolean> = signal(false);
  private readonly arrayDrafts: WritableSignal<Readonly<Record<string, { multiple: boolean }>>> = signal({});
  private pendingOperations: number = 0;
  private mutationQueue: Promise<void> = Promise.resolve();
  private readonly queuedNames: Map<string, string> = new Map();
  protected readonly ownModelName: Signal<string | null> = computed(() => this.workspace.queries.nodeOwner()?.name ?? null);
  protected readonly ownLevel: Signal<number> = computed(
    () => this.workspace.queries.nodeOwner()?.levelIndex ?? this.workspace.store.currentLevelIndex(),
  );
  protected readonly properties: Signal<readonly Attribute[]> = computed(
    () => this.workspace.queries.currentNode()?.attributes ?? [],
  );
  protected readonly inherited: Signal<readonly InheritedAttribute[]> = computed(() =>
    [...this.workspace.queries.inheritedAttributes().values()].flat(),
  );
  protected readonly expandedGroups: WritableSignal<readonly AccordionValue[]> = signal(['inherited', 'own']);
  protected readonly types: Signal<readonly AutocompleteOption[]> = computed(() => {
    const options: AutocompleteOption[] = this.workspace.queries
      .dataTypeSuggestions()
      .map((type) => ({ label: type.name, value: type.ref }));
    for (const property of this.properties()) {
      if (!options.some((option) => option.value === property.typeId))
        options.push({
          value: property.typeId,
          label: this.workspace.queries.resolveTypeLabel(property.typeId, this.workspace.store.currentLevelIndex()),
        });
    }
    return options;
  });
  private readonly orderDraft: WritableSignal<readonly PropertyListItem[] | null> = signal(null);
  protected readonly items: Signal<readonly PropertyListItem[]> = computed(
    () => this.orderDraft() ?? this.properties().map((attribute) => ({ label: attribute.name, value: attribute.id, attribute })),
  );
  protected readonly orderLabels: Signal<Partial<OrderListLabels<PropertyListItem>>> = computed(() => {
    this.appearance.language();
    return {
      reorder: (item) => this.translations.translate('editor.reorderProperty', { name: item.label }),
      moveUp: this.translations.translate('editor.propertyOrder.up'),
      moveDown: this.translations.translate('editor.propertyOrder.down'),
      moveToTop: this.translations.translate('editor.propertyOrder.top'),
      moveToBottom: this.translations.translate('editor.propertyOrder.bottom'),
      empty: this.translations.translate('editor.noProperties'),
      instructions: this.translations.translate('editor.propertyOrder.instructions'),
      moved: (event: OrderListReorderEvent<PropertyListItem>, count: number) =>
        this.translations.translate('editor.propertyOrder.moved', {
          name: event.item.label,
          position: event.currentIndex + 1,
          count,
        }),
    };
  });
  protected readonly newName: WritableSignal<string> = signal('');
  protected readonly newType: WritableSignal<string> = signal(DataTypes.String);
  protected readonly newArray: WritableSignal<boolean> = signal(false);
  protected readonly creationError: WritableSignal<string | null> = signal(null);

  public constructor() {
    effect(() => {
      this.workspace.store.currentNodeId();
      this.drafts.set({});
      this.arrayDrafts.set({});
      this.error.set(null);
      this.orderDraft.set(null);
      this.newName.set('');
      this.newType.set(DataTypes.String);
      this.newArray.set(false);
      this.creationError.set(null);
    });
  }

  public canLeave(): boolean {
    return !this.busy() && !this.draft() && !this.newName().trim();
  }

  public guardLeave(): boolean {
    const draft: { id: string; name: string } | null = this.draft();
    if (draft) this.focusProperty(draft.id);
    else if (this.newName().trim()) this.focusNew();
    return this.canLeave();
  }

  public focusProperty(id: string): void {
    if (this.revealOwnGroup(() => this.focusProperty(id))) return;
    const rows: NodeListOf<HTMLElement> = this.element.nativeElement.querySelectorAll('[data-property-id]');
    [...rows]
      .find((row) => row.dataset['propertyId'] === id)
      ?.querySelector<HTMLElement>('input, button')
      ?.focus({ preventScroll: true });
  }

  public details(
    attribute?: Attribute,
    editable: boolean = this.workspace.queries.nodeEditable(),
    levelIndex: number | null = null,
  ): void {
    void this.afterSaves(() => {
      const current: Attribute | undefined = attribute
        ? (this.properties().find((item) => item.id === attribute.id) ?? attribute)
        : undefined;
      this.dialogs.open(PropertyDetailsDialog, {
        headerKey: current ? (editable ? 'editor.editProperties' : 'editor.propertyList.viewTitle') : 'editor.addProperty',
        inputValues: { attribute: current, editable, levelIndex },
      });
    });
  }

  protected inspectInherited(entry: InheritedAttribute): void {
    void this.afterSaves(() => this.inspect.emit(entry));
  }

  protected requestAction(property: Attribute, action: 'remove' | 'duplicate'): void {
    void this.afterSaves(() => this[action].emit(property));
  }

  private async afterSaves(action: () => void): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    await this.mutationQueue;
    if (this.destroyRef.destroyed || nodeId !== this.workspace.store.currentNodeId()) return;
    if (this.guardLeave()) action();
  }

  protected name(property: Attribute): string {
    return this.drafts()[property.id] ?? property.name;
  }

  protected changeName(property: Attribute, name: string): void {
    this.drafts.update((drafts) => ({ ...drafts, [property.id]: name }));
    this.error.set(null);
  }

  protected cancel(event: Event): void {
    event.stopPropagation();
    if (!(event.target instanceof HTMLElement)) return;
    const id: string | undefined = event.target.closest<HTMLElement>('[data-property-id]')?.dataset['propertyId'];
    if (id) this.clearNameDraft(id);
    this.error.set(null);
    event.target.blur();
  }

  protected async saveName(property: Attribute, event?: Event): Promise<void> {
    event?.preventDefault();
    const name: string | undefined = this.drafts()[property.id]?.trim();
    if (name === undefined || this.queuedNames.get(property.id) === name) return;
    if (!name) {
      this.error.set({ id: property.id, field: 'name', message: this.translations.translate('editor.propertyNameRequired') });
      return;
    }
    if (name === property.name) {
      this.clearNameDraft(property.id);
      return;
    }
    this.queuedNames.set(property.id, name);
    await this.update(property, { name }, () => {
      if (this.drafts()[property.id]?.trim() === name) this.clearNameDraft(property.id);
    });
    if (this.queuedNames.get(property.id) === name) this.queuedNames.delete(property.id);
  }

  private clearNameDraft(id: string): void {
    this.drafts.update((drafts) => {
      return Object.fromEntries(Object.entries(drafts).filter(([key]) => key !== id));
    });
  }

  protected isArray(property: Attribute): boolean {
    return this.arrayDrafts()[property.id]?.multiple ?? property.bounds.upperBound !== 1;
  }

  protected async changeArray(property: Attribute, multiple: boolean): Promise<void> {
    if (multiple === this.isArray(property)) return;
    const draft: { multiple: boolean } = { multiple };
    this.arrayDrafts.update((drafts) => ({ ...drafts, [property.id]: draft }));
    await this.update(property, {
      bounds: { lowerBound: Math.min(property.bounds.lowerBound, 1), upperBound: multiple ? -1 : 1 },
      ...(multiple ? { isKey: false } : {}),
    });
    if (this.arrayDrafts()[property.id] === draft)
      this.arrayDrafts.update((drafts) => Object.fromEntries(Object.entries(drafts).filter(([id]) => id !== property.id)));
  }

  public focusNew(): void {
    if (this.revealOwnGroup(() => this.focusNew())) return;
    this.element.nativeElement.querySelector<HTMLInputElement>('[data-new-property]')?.focus({ preventScroll: true });
  }

  private revealOwnGroup(focus: () => void): boolean {
    if (this.expandedGroups().includes('own')) return false;
    this.expandedGroups.update((groups) => [...groups, 'own']);
    afterNextRender(
      () => {
        if (!this.destroyRef.destroyed) focus();
      },
      { injector: this.injector },
    );
    return true;
  }

  protected changeNewType(value: unknown): void {
    if (typeof value === 'string' && this.types().some((type) => type.value === value)) this.newType.set(value);
  }

  protected leaveNewName(event: FocusEvent): void {
    const row: Element | null = event.target instanceof Element ? event.target.closest('.new-property-row') : null;
    if (row && event.relatedTarget instanceof Node && row.contains(event.relatedTarget)) return;
    void this.createInline(false);
  }

  protected cancelNew(event: Event): void {
    event.stopPropagation();
    this.newName.set('');
    this.newType.set(DataTypes.String);
    this.newArray.set(false);
    this.creationError.set(null);
  }

  protected async createInline(focusNext: boolean = true): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    const name: string = this.newName().trim();
    if (!nodeId || !context || !name || this.creating() || !this.workspace.queries.nodeEditable()) return;
    const typeId: string = this.newType();
    const multiple: boolean = this.newArray();
    this.creating.set(true);
    await this.enqueue(async (): Promise<void> => {
      if (!this.isCurrent(context, nodeId)) return;
      this.creationError.set(null);
      try {
        const property: Attribute = await this.workspace.actions.createAttribute(nodeId, {
          name,
          typeId,
          bounds: { lowerBound: 0, upperBound: multiple ? -1 : 1 },
        });
        if (!this.isCurrent(context, nodeId)) return;
        this.newName.set('');
        if (this.newType() === typeId) this.newType.set(DataTypes.String);
        if (this.newArray() === multiple) this.newArray.set(false);
        this.editing.select(property.id);
        if (focusNext) afterNextRender(() => this.focusNew(), { injector: this.injector });
      } catch (error: unknown) {
        if (this.isCurrent(context, nodeId)) this.reportCreationError(error);
      }
    });
    this.creating.set(false);
  }

  private reportCreationError(error: unknown): void {
    if (error instanceof FieldValidationError) this.creationError.set(error.message);
    else this.projects.reportError(error);
  }

  protected async changeType(property: Attribute, value: unknown): Promise<void> {
    if (typeof value !== 'string' || value === property.typeId || !this.types().some((type) => type.value === value)) return;
    await this.update(property, { typeId: value });
  }

  protected async reorder(event: OrderListReorderEvent<PropertyListItem>): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!nodeId || !context || this.draft() || this.newName().trim() || !this.workspace.queries.nodeEditable()) return;
    const previous: readonly PropertyListItem[] = this.items();
    const items: PropertyListItem[] = [...previous];
    items.splice(event.previousIndex, 1);
    items.splice(event.currentIndex, 0, event.item);
    this.orderDraft.set(items);
    await this.enqueue(async (): Promise<void> => {
      if (!this.isCurrent(context, nodeId)) return;
      try {
        await this.workspace.actions.reorderAttributes(
          nodeId,
          items.map((item) => item.value),
        );
        if (this.isCurrent(context, nodeId) && this.orderDraft() === items) this.orderDraft.set(null);
      } catch (error: unknown) {
        if (this.isCurrent(context, nodeId)) {
          if (this.orderDraft() === items) this.orderDraft.set(null);
          this.projects.reportError(error);
        }
      }
    });
  }

  private async update(property: Attribute, patch: UpdateAttributeInput, saved?: () => void): Promise<boolean> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!nodeId || !context || !this.workspace.queries.nodeEditable()) return false;
    return this.enqueue(async (): Promise<boolean> => {
      if (!this.isCurrent(context, nodeId)) return false;
      this.error.set(null);
      try {
        await this.workspace.actions.updateAttribute(nodeId, property.id, patch);
        if (!this.isCurrent(context, nodeId)) return false;
        saved?.();
        return true;
      } catch (error: unknown) {
        if (!this.isCurrent(context, nodeId)) return false;
        if (error instanceof FieldValidationError)
          this.error.set({ id: property.id, field: error.field, message: error.message });
        else this.projects.reportError(error);
        return false;
      }
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    this.pendingOperations++;
    this.busy.set(true);
    const task: Promise<T> = this.mutationQueue
      .then(async () => {
        await this.allowInputPaint();
        return operation();
      })
      .finally(() => {
        this.pendingOperations--;
        this.busy.set(this.pendingOperations > 0);
      });
    this.mutationQueue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private allowInputPaint(): Promise<void> {
    return new Promise((resolve) => {
      // Paint Sushi's local selection before synchronous model validation starts.
      // Hidden windows still need to save when animation frames are suspended.
      const fallback: ReturnType<typeof setTimeout> = setTimeout(() => {
        cancelAnimationFrame(frame);
        resolve();
      }, 50);
      const frame: number = requestAnimationFrame(() => {
        clearTimeout(fallback);
        setTimeout(resolve, 0);
      });
    });
  }

  private isCurrent(context: WorkspaceContext, nodeId: string): boolean {
    return !this.destroyRef.destroyed && this.workspace.isCurrent(context) && this.workspace.store.currentNodeId() === nodeId;
  }
}
