import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Injector,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
  linkedSignal,
  type Signal,
  type WritableSignal,
  type OutputEmitterRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { translateSignal, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideSettings2,
  LucideTrash,
  LucideEye,
  LucideCornerUpRight,
  LucideCopy,
  LucidePlus,
  LucideGripVertical,
  LucideLockKeyhole,
  LucideKeyRound,
} from '@lucide/angular';
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
import { DataTypes, type Diagnostic, type Model, type Attribute, type UpdateAttributeInput } from '@ramen-suite/core/model';
import { WorkspaceService, type WorkspaceContext } from '../../../../../services/workspace/workspace.service';
import { ProjectService } from '../../../../../services/projects/project.service';
import { DialogService } from '../../../../../services/interaction/dialog.service';
import { PropertyEditingService } from '../../../../../services/workspace/editing/property-editing.service';
import type { InheritedAttribute } from '../../../../../models/WorkspaceDetails';
import { FieldValidationError } from '../../../../../models/FieldValidationError';
import { PropertyDetailsDialog } from '../../../dialogs/property-details/property-details.dialog';
import { PropertyTypeComponent } from './property-type/property-type.component';
import { ScrollOverflowDirective } from '../../../../../directives/scroll-overflow.directive';
import { ScrollHintsComponent } from '../../../shared/scroll-hints/scroll-hints.component';
import { IconTooltipDirective, TooltipDirective } from '../../../../../directives/tooltip.directive';

interface PropertyListItem {
  readonly label: string;
  readonly value: string;
  readonly attribute: Attribute;
}

interface PropertyIssue {
  readonly field: string;
  readonly message: string;
}

@Component({
  selector: 'nori-property-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollOverflowDirective,
    ScrollHintsComponent,
    FormsModule,
    NgTemplateOutlet,
    TranslocoDirective,
    Button,
    Accordion,
    AccordionItem,
    AccordionHeaderTemplate,
    Input,
    PropertyTypeComponent,
    OrderList,
    OrderListItemTemplate,
    LucideSettings2,
    LucideTrash,
    LucideEye,
    LucideCornerUpRight,
    LucideCopy,
    LucidePlus,
    LucideGripVertical,
    LucideLockKeyhole,
    LucideKeyRound,
    IconTooltipDirective,
    TooltipDirective,
  ],
  templateUrl: './property-list.component.html',
  styleUrl: './property-list.component.scss',
})
export class PropertyListComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly editing: PropertyEditingService = inject(PropertyEditingService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly injector: Injector = inject(Injector);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly dialogs: DialogService = inject(DialogService);
  public readonly inspect: OutputEmitterRef<InheritedAttribute> = output();
  public readonly remove: OutputEmitterRef<Attribute> = output<Attribute>();
  public readonly duplicate: OutputEmitterRef<Attribute> = output<Attribute>();
  public readonly isBusy: Signal<boolean> = computed((): boolean => this.pendingOperations() > 0);
  private readonly nodeContext: Signal<string> = computed((): string =>
    JSON.stringify([this.workspace.context(), this.workspace.store.currentNodeId()]),
  );
  protected readonly error: WritableSignal<{ id: string; field: string; message: string } | null> = linkedSignal({
    source: this.nodeContext,
    computation: (): { id: string; field: string; message: string } | null => null,
  });
  protected readonly drafts: WritableSignal<Readonly<Record<string, string>>> = linkedSignal({
    source: this.nodeContext,
    computation: (): Readonly<Record<string, string>> => ({}),
  });
  protected readonly draft: Signal<{ id: string; name: string } | null> = computed((): { id: string; name: string } | null => {
    const entry: [string, string] | undefined = Object.entries(this.drafts())[0];
    return entry ? { id: entry[0], name: entry[1] } : null;
  });
  protected readonly isCreating: WritableSignal<boolean> = signal(false);
  private readonly pendingOperations: WritableSignal<number> = signal(0);
  private mutationQueue: Promise<void> = Promise.resolve();
  private readonly queuedNames: Map<string, string> = new Map();
  protected readonly ownModelName: Signal<string | null> = computed(
    (): string | null => this.workspace.queries.nodeOwner()?.name ?? null,
  );
  protected readonly ownLevel: Signal<number> = computed(
    (): number => this.workspace.queries.nodeOwner()?.levelIndex ?? this.workspace.store.currentLevelIndex(),
  );
  protected readonly properties: Signal<readonly Attribute[]> = computed(
    (): Attribute[] => this.workspace.queries.currentNode()?.attributes ?? [],
  );
  protected readonly inherited: Signal<readonly InheritedAttribute[]> = computed((): InheritedAttribute[] =>
    [...this.workspace.queries.inheritedAttributes().values()].flat(),
  );
  protected readonly expandedGroups: WritableSignal<readonly AccordionValue[]> = signal(['inherited', 'own']);
  protected readonly types: Signal<readonly AutocompleteOption[]> = computed((): readonly AutocompleteOption[] => {
    const options: AutocompleteOption[] = this.workspace.queries
      .dataTypeSuggestions()
      .map((type): { label: string; value: string } => ({ label: type.name, value: type.ref }));
    for (const property of this.properties()) {
      if (!options.some((option): boolean => option.value === property.typeId))
        options.push({
          value: property.typeId,
          label: this.workspace.queries.resolveTypeLabel(property.typeId, this.workspace.store.currentLevelIndex()),
        });
    }
    return options;
  });
  private readonly orderDraft: WritableSignal<readonly PropertyListItem[] | null> = linkedSignal({
    source: this.nodeContext,
    computation: (): readonly PropertyListItem[] | null => null,
  });
  protected readonly items: Signal<readonly PropertyListItem[]> = computed(
    (): readonly PropertyListItem[] =>
      this.orderDraft() ??
      this.properties().map((attribute): { label: string; value: string; attribute: Attribute } => ({
        label: attribute.name,
        value: attribute.id,
        attribute,
      })),
  );
  private readonly moveUpLabel: Signal<string> = translateSignal('editor.propertyOrder.up');
  private readonly moveDownLabel: Signal<string> = translateSignal('editor.propertyOrder.down');
  private readonly moveToTopLabel: Signal<string> = translateSignal('editor.propertyOrder.top');
  private readonly moveToBottomLabel: Signal<string> = translateSignal('editor.propertyOrder.bottom');
  private readonly emptyLabel: Signal<string> = translateSignal('editor.noProperties');
  private readonly instructionsLabel: Signal<string> = translateSignal('editor.propertyOrder.instructions');
  protected readonly orderLabels: Signal<Partial<OrderListLabels<PropertyListItem>>> = computed(
    (): Partial<OrderListLabels<PropertyListItem>> => {
      return {
        reorder: (item): string => this.translations.translate('editor.reorderProperty', { name: item.label }),
        moveUp: this.moveUpLabel(),
        moveDown: this.moveDownLabel(),
        moveToTop: this.moveToTopLabel(),
        moveToBottom: this.moveToBottomLabel(),
        empty: this.emptyLabel(),
        instructions: this.instructionsLabel(),
        moved: (event: OrderListReorderEvent<PropertyListItem>, count: number): string =>
          this.translations.translate('editor.propertyOrder.moved', {
            name: event.item.label,
            position: event.currentIndex + 1,
            count,
          }),
      };
    },
  );
  protected readonly newName: WritableSignal<string> = linkedSignal({ source: this.nodeContext, computation: (): string => '' });
  protected readonly newType: WritableSignal<string> = linkedSignal({
    source: this.nodeContext,
    computation: (): string => DataTypes.String,
  });
  protected readonly isNewList: WritableSignal<boolean> = linkedSignal({
    source: this.nodeContext,
    computation: (): boolean => false,
  });
  private readonly importedIssues: Signal<ReadonlyMap<string, readonly PropertyIssue[]>> = computed(
    (): Map<string, PropertyIssue[]> => {
      const issues: Map<string, PropertyIssue[]> = new Map();
      const models: readonly Model[] = this.workspace.store.getModels();
      for (const finding of this.workspace.queries.validation()?.diagnostics ?? []) {
        if (finding.severity !== 'error') continue;
        const target: readonly [string, PropertyIssue] | undefined = this.resolvePropertyIssue(finding, models);
        if (!target) continue;
        const [key, issue] = target;
        const group: PropertyIssue[] = issues.get(key) ?? [];
        group.push(issue);
        issues.set(key, group);
      }
      return issues;
    },
  );

  protected issuesFor(
    id: string,
    modelId: string | undefined = this.workspace.store.currentModel()?.id,
  ): readonly PropertyIssue[] {
    const findings: readonly PropertyIssue[] = this.importedIssues().get(JSON.stringify([modelId, id])) ?? [];
    const draft: ReturnType<typeof this.error> = this.error();
    return draft?.id === id && modelId === this.workspace.store.currentModel()?.id ? [draft, ...findings] : findings;
  }

  private resolvePropertyIssue(finding: Diagnostic, models: readonly Model[]): readonly [string, PropertyIssue] | undefined {
    const match: RegExpMatchArray | null | undefined = finding.path?.match(
      /^\/models\/([^/]+)\/classifiers\/(\d+)\/attributes(?:\/(\d+))?(?:\/([^/]+))?/,
    );
    if (!match) return undefined;
    const [, modelId, classifierIndex, attributeIndex, pathField] = match;
    const classifier: Model['classifiers'][number] | undefined = models.find((model): boolean => model.id === modelId)
      ?.classifiers[Number(classifierIndex)];
    if (classifier?.kind !== 'Node') return undefined;
    const attribute: Attribute | undefined =
      attributeIndex === undefined
        ? classifier.attributes.find((item): boolean => item.id === finding.ref)
        : classifier.attributes[Number(attributeIndex)];
    if (!attribute) return undefined;
    const field: string = pathField ?? (finding.code.includes('ATTRIBUTE_NAME') ? 'name' : '');
    return [JSON.stringify([modelId, attribute.id]), { field, message: finding.message }];
  }

  protected hasIssue(issues: readonly PropertyIssue[], field: string): boolean {
    return issues.some((issue: PropertyIssue): boolean => issue.field === field);
  }

  protected readonly creationError: WritableSignal<string | null> = linkedSignal({
    source: this.nodeContext,
    computation: (): string | null => null,
  });

  public canLeave(): boolean {
    const draft: ReturnType<typeof this.draft> = this.draft();
    const error: ReturnType<typeof this.error> = this.error();
    const hasUnsavedName: boolean = !!draft && !(error?.field === 'name' && error.id === draft.id);
    return !this.isBusy() && !hasUnsavedName && (!this.newName().trim() || !!this.creationError());
  }

  public discardInvalidDrafts(): void {
    if (this.isBusy()) return;
    if (this.creationError()) this.resetNewDraft();
    const error: ReturnType<typeof this.error> = this.error();
    if (error?.field === 'name') {
      this.clearNameDraft(error.id);
      this.error.set(null);
    }
  }

  public guardLeave(): boolean {
    if (this.canLeave()) return true;
    const draft: { id: string; name: string } | null = this.draft();
    if (draft) this.focusProperty(draft.id);
    else if (this.newName().trim()) this.focusNew();
    return false;
  }

  public focusProperty(id: string, selectName: boolean = false): boolean {
    const own: boolean = this.properties().some((property): boolean => property.id === id);
    if (!own && !this.inherited().some((entry): boolean => entry.attribute.id === id)) return false;
    if (this.revealGroup(own ? 'own' : 'inherited', (): boolean => this.focusProperty(id, selectName))) return true;
    const rows: NodeListOf<HTMLElement> = this.element.nativeElement.querySelectorAll(
      own ? '[data-property-id]' : '[data-inherited-property-id]',
    );
    const row: HTMLElement | undefined = [...rows].find(
      (entry): boolean => (own ? entry.dataset['propertyId'] : entry.dataset['inheritedPropertyId']) === id,
    );
    const nameInput: HTMLInputElement | null | undefined = row?.querySelector<HTMLInputElement>(
      '.name-field input:not(:disabled)',
    );
    const target: HTMLElement | null | undefined = nameInput ?? row?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    if (!target) return false;
    return this.focusPropertyControl(target, selectName);
  }

  private focusPropertyControl(target: HTMLElement, selectName: boolean): boolean {
    target.focus({ preventScroll: true });
    if (target.ownerDocument.activeElement !== target) return false;
    if (selectName) {
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
      if (target instanceof HTMLInputElement) {
        target.select();
        requestAnimationFrame((): void => {
          if (target.ownerDocument.activeElement === target) target.select();
        });
      }
    }
    return true;
  }

  public focusInheritedSource(property: InheritedAttribute): boolean {
    if (this.revealGroup('inherited', (): boolean => this.focusInheritedSource(property))) return true;
    const rows: NodeListOf<HTMLElement> = this.element.nativeElement.querySelectorAll('[data-inherited-property-id]');
    const row: HTMLElement | undefined = [...rows].find(
      (entry: HTMLElement): boolean =>
        entry.dataset['inheritedPropertyId'] === property.attribute.id && entry.dataset['sourceModelId'] === property.modelId,
    );
    const target: HTMLButtonElement | null | undefined = row?.querySelector<HTMLButtonElement>('[data-property-source]');
    return !!target && this.focusPropertyControl(target, true);
  }

  public details(
    attribute?: Attribute,
    editable: boolean = this.workspace.queries.isNodeEditable(),
    levelIndex: number | null = null,
  ): void {
    void this.afterSaves((): void => {
      const current: Attribute | undefined = attribute
        ? (this.properties().find((item): boolean => item.id === attribute.id) ?? attribute)
        : undefined;
      this.dialogs.open(PropertyDetailsDialog, {
        width: 'var(--nori-dialog-width)',
        header: current ? current.name : undefined,
        headerKey: current ? undefined : 'editor.addProperty',
        inputValues: { attribute: current, editable, levelIndex },
      });
    });
  }

  protected inspectInherited(entry: InheritedAttribute): void {
    void this.afterSaves((): void => this.inspect.emit(entry));
  }

  protected requestAction(property: Attribute, action: 'remove' | 'duplicate'): void {
    void this.afterSaves((): void => this[action].emit(property));
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
    this.drafts.update((drafts): Readonly<Record<string, string>> => ({ ...drafts, [property.id]: name }));
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
    if (!event && this.error()?.id === property.id) return;
    if (!name) {
      this.error.set({ id: property.id, field: 'name', message: this.translations.translate('editor.propertyNameRequired') });
      return;
    }
    if (name === property.name) {
      this.clearNameDraft(property.id);
      return;
    }
    this.queuedNames.set(property.id, name);
    await this.update(property, { name }, (): void => {
      if (this.drafts()[property.id]?.trim() === name) this.clearNameDraft(property.id);
    });
    if (this.queuedNames.get(property.id) === name) this.queuedNames.delete(property.id);
  }

  private clearNameDraft(id: string): void {
    this.drafts.update((drafts): Readonly<Record<string, string>> => {
      return Object.fromEntries(Object.entries(drafts).filter(([key]): boolean => key !== id));
    });
  }

  protected isArray(property: Attribute): boolean {
    return property.bounds.upperBound !== 1;
  }

  protected async changeArray(property: Attribute, multiple: boolean): Promise<void> {
    if (property.isKey || multiple === this.isArray(property)) return;
    await this.update(property, {
      bounds: { lowerBound: Math.min(property.bounds.lowerBound, 1), upperBound: multiple ? -1 : 1 },
    });
  }

  public focusNew(): void {
    if (this.revealGroup('own', (): void => this.focusNew())) return;
    this.element.nativeElement.querySelector<HTMLInputElement>('[data-new-property]')?.focus({ preventScroll: true });
  }

  private revealGroup(group: 'own' | 'inherited', focus: () => void): boolean {
    if (this.expandedGroups().includes(group)) return false;
    this.expandedGroups.update((groups): string[] => [...groups, group]);
    afterNextRender(
      (): void => {
        if (!this.destroyRef.destroyed) focus();
      },
      { injector: this.injector },
    );
    return true;
  }

  protected changeNewType(value: unknown): void {
    if (typeof value === 'string' && this.types().some((type): boolean => type.value === value)) this.newType.set(value);
  }

  protected leaveNewName(event: FocusEvent): void {
    if (this.creationError()) return;
    const row: Element | null = event.target instanceof Element ? event.target.closest('.new-property-row') : null;
    if (row && event.relatedTarget instanceof Node && row.contains(event.relatedTarget)) return;
    void this.createInline(false);
  }

  protected cancelNew(event: Event): void {
    event.stopPropagation();
    this.resetNewDraft();
  }

  private resetNewDraft(): void {
    this.newName.set('');
    this.newType.set(DataTypes.String);
    this.isNewList.set(false);
    this.creationError.set(null);
  }

  protected async createInline(focusNext: boolean = true): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    const name: string = this.newName().trim();
    if (!nodeId || !context || !name || this.isCreating() || !this.workspace.queries.isNodeEditable()) return;
    const typeId: string = this.newType();
    const multiple: boolean = this.isNewList();
    this.isCreating.set(true);
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
        if (this.isNewList() === multiple) this.isNewList.set(false);
        this.editing.select(property.id);
        if (focusNext) afterNextRender((): void => this.focusNew(), { injector: this.injector });
      } catch (error: unknown) {
        if (this.isCurrent(context, nodeId)) this.reportCreationError(error);
      }
    });
    this.isCreating.set(false);
  }

  private reportCreationError(error: unknown): void {
    if (error instanceof FieldValidationError) {
      this.creationError.set(error.message);
    } else this.projects.reportError(error);
  }

  protected async changeType(property: Attribute, value: unknown): Promise<void> {
    if (typeof value !== 'string' || value === property.typeId || !this.types().some((type): boolean => type.value === value))
      return;
    await this.update(property, { typeId: value });
  }

  protected async reorder(event: OrderListReorderEvent<PropertyListItem>): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!nodeId || !context || this.draft() || this.newName().trim() || !this.workspace.queries.isNodeEditable()) return;
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
          items.map((item): string => item.value),
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
    if (!nodeId || !context || !this.workspace.queries.isNodeEditable()) return false;
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
    this.pendingOperations.update((count: number): number => count + 1);
    const task: Promise<T> = this.mutationQueue
      .then(async (): Promise<T> => {
        await this.allowInputPaint();
        return operation();
      })
      .finally((): void => {
        this.pendingOperations.update((count: number): number => count - 1);
      });
    this.mutationQueue = task.then(
      (): undefined => undefined,
      (): undefined => undefined,
    );
    return task;
  }

  private allowInputPaint(): Promise<void> {
    return new Promise((resolve): void => {
      // Paint Sushi's local selection before synchronous model validation starts.
      // Hidden windows still need to save when animation frames are suspended.
      const fallback: ReturnType<typeof setTimeout> = setTimeout((): void => {
        cancelAnimationFrame(frame);
        resolve();
      }, 50);
      const frame: number = requestAnimationFrame((): void => {
        clearTimeout(fallback);
        setTimeout(resolve, 0);
      });
    });
  }

  private isCurrent(context: WorkspaceContext, nodeId: string): boolean {
    return !this.destroyRef.destroyed && this.workspace.isCurrent(context) && this.workspace.store.currentNodeId() === nodeId;
  }
}
