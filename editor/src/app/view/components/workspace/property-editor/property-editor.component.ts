import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  DestroyRef,
  ElementRef,
  Injector,
  inject,
  signal,
  viewChild,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideArrowDownUp,
  LucideInfo,
  LucideSave,
  LucideUndo2,
  LucideEraser,
  LucideCopy,
  LucidePlus,
  LucideArrowLeft,
  LucideList,
  LucideTags,
  LucideShieldCheck,
  LucideX,
} from '@lucide/angular';
import type { Attribute } from '@ramen-suite/core/model';
import { RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import {
  Button,
  Divider,
  Message,
  List,
  ListItemTemplate,
  OrderList,
  OrderListItemTemplate,
  type ListTrackBy,
  type OrderListLabels,
  type OrderListReorderEvent,
} from '@sushi-kit/angular';
import { ScrollOverflowDirective } from '../../../../directives/scroll-overflow.directive';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import type { InheritedAttribute, NodeDefinition } from '../../../../models/WorkspaceDetails';
import type { WorkspaceLocation } from '../../../../models/WorkspaceLocation';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { ProjectService } from '../../../../services/projects/project.service';
import { PropertyEditingService } from '../../../../services/workspace/editing/property-editing.service';
import { WorkspaceService, type WorkspaceContext } from '../../../../services/workspace/workspace.service';
import { ApplicationState } from '../../../../states/application.state';
import { groupBy } from '../../../../utils/collections';
import { ScrollHintsComponent } from '../../shared/scroll-hints/scroll-hints.component';
import { ConfirmationDialog, type ConfirmationOptions } from '../../dialogs/confirmation/confirmation.dialog';
import { NodeAttributeComponent } from '../inspector/node-view/node-attributes/node-attribute/node-attribute.component';
import { NotificationsComponent } from '../../shell/notifications/notifications.component';
import { DialogHostComponent } from '../../shell/dialog-host/dialog-host.component';
import { NodeContextPanelComponent } from './node-context-panel/node-context-panel.component';
import { ShapeEditorComponent } from './shape-editor/shape-editor.component';
import { PropertyFormComponent } from './property-form/property-form.component';

interface PropertyOrderItem {
  readonly label: string;
  readonly value: string;
  readonly attribute: Attribute;
}

interface InheritedPropertyGroup {
  readonly levelIndex: number;
  readonly modelName: string | null;
  readonly properties: readonly InheritedAttribute[];
}

/** Coordinates property drafts, explicit save decisions and inherited-node navigation. */
@Component({
  selector: 'nori-property-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'handleEscape($event)' },
  imports: [
    CdkScrollable,
    OrderList,
    OrderListItemTemplate,
    LucideArrowDownUp,
    LucideX,
    TranslocoDirective,
    Button,
    Message,
    LucideInfo,
    Divider,
    List,
    ListItemTemplate,
    LucideCopy,
    LucideSave,
    LucideUndo2,
    LucideEraser,
    LucidePlus,
    LucideArrowLeft,
    LucideList,
    LucideTags,
    LucideShieldCheck,
    PropertyFormComponent,
    ShapeEditorComponent,
    NodeContextPanelComponent,
    NotificationsComponent,
    DialogHostComponent,
    NodeAttributeComponent,
    ScrollOverflowDirective,
    ScrollHintsComponent,
    TooltipDirective,
  ],
  templateUrl: './property-editor.component.html',
  styleUrl: './property-editor.component.scss',
})
export class PropertyEditorComponent {
  protected readonly editing: PropertyEditingService = inject(PropertyEditingService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly appearance: ApplicationState = inject(ApplicationState);
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector: Injector = inject(Injector);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly nodePanel: Signal<NodeContextPanelComponent | undefined> = viewChild(NodeContextPanelComponent);
  protected readonly shapeEditor: Signal<ShapeEditorComponent | undefined> = viewChild(ShapeEditorComponent);
  protected readonly form: Signal<PropertyFormComponent | undefined> = viewChild(PropertyFormComponent);
  private readonly orderList: Signal<OrderList<PropertyOrderItem> | undefined> = viewChild(OrderList<PropertyOrderItem>);

  protected readonly trackProperty: ListTrackBy<Attribute> = (_index: number, property: Attribute): string => property.id;
  protected readonly trackInheritedProperty: ListTrackBy<InheritedAttribute> = (
    _index: number,
    property: InheritedAttribute,
  ): string => `${property.modelId}:${property.attribute.id}`;

  protected readonly savingOrder: WritableSignal<boolean> = signal(false);
  protected readonly switchingNode: WritableSignal<boolean> = signal(false);
  protected readonly switchingSection: WritableSignal<boolean> = signal(false);
  protected readonly initialArrival: WritableSignal<boolean> = signal(true);
  protected readonly detailVisible: WritableSignal<boolean> = signal(true);
  private readonly orderDraft: WritableSignal<readonly Attribute[] | null> = signal(null);
  private readonly lifetime: AbortController = new AbortController();

  protected readonly inheritedSelection: Signal<InheritedAttribute | null> = computed(
    () =>
      [...this.workspace.queries.inheritedAttributes().values()]
        .flat()
        .find((property: InheritedAttribute): boolean => property.attribute.id === this.editing.current()?.attributeId) ?? null,
  );

  protected readonly properties: Signal<readonly Attribute[]> = computed(
    () => this.workspace.queries.currentNode()?.attributes ?? [],
  );
  protected readonly sorting: Signal<boolean> = computed(() => this.orderDraft() !== null);
  private readonly sortedProperties: Signal<readonly Attribute[]> = computed(() => this.orderDraft() ?? this.properties());
  protected readonly orderItems: Signal<readonly PropertyOrderItem[]> = computed(() =>
    this.sortedProperties().map(
      (attribute: Attribute): PropertyOrderItem => ({ value: attribute.id, label: attribute.name, attribute }),
    ),
  );
  protected readonly orderLabels: Signal<Partial<OrderListLabels<PropertyOrderItem>>> = computed(() => {
    this.appearance.language();
    return {
      reorder: (item: PropertyOrderItem): string => this.translations.translate('editor.reorderProperty', { name: item.label }),
      moveUp: this.translations.translate('editor.propertyOrder.up'),
      moveDown: this.translations.translate('editor.propertyOrder.down'),
      moveToTop: this.translations.translate('editor.propertyOrder.top'),
      moveToBottom: this.translations.translate('editor.propertyOrder.bottom'),
      empty: this.translations.translate('editor.noProperties'),
      instructions: this.translations.translate('editor.propertyOrder.instructions'),
      moved: (event: OrderListReorderEvent<PropertyOrderItem>, count: number): string =>
        this.translations.translate('editor.propertyOrder.moved', {
          name: event.item.label,
          position: event.currentIndex + 1,
          count,
        }),
    };
  });
  protected readonly orderChanged: Signal<boolean> = computed(() =>
    this.sortedProperties().some((property: Attribute, index: number): boolean => property.id !== this.properties()[index]?.id),
  );
  protected readonly controlsUnavailable: Signal<boolean> = computed(
    () => this.dialogs.pending() || this.editing.changingNode() || this.switchingNode(),
  );
  protected readonly actionPending: Signal<boolean> = computed(
    () => this.controlsUnavailable() || !!this.form()?.saving() || this.savingOrder(),
  );

  protected readonly inheritedGroups: Signal<readonly InheritedPropertyGroup[]> = computed(() => {
    const inherited: readonly InheritedAttribute[] = [...this.workspace.queries.inheritedAttributes().values()].flat();
    const groups: ReadonlyMap<number, readonly InheritedAttribute[]> = groupBy(
      inherited,
      (property: InheritedAttribute): number => property.levelIndex,
    );

    return [...groups]
      .sort(([left], [right]): number => left - right)
      .map(
        ([levelIndex, properties]): InheritedPropertyGroup => ({
          levelIndex,
          modelName: this.projects.recordsByLevelIndex().get(levelIndex)?.name ?? null,
          properties,
        }),
      );
  });
  protected readonly ownLevelIndex: Signal<number> = computed(
    () => this.workspace.queries.nodeOwner()?.levelIndex ?? this.workspace.store.currentLevelIndex(),
  );
  protected readonly ownModelName: Signal<string | null> = computed(() => this.workspace.queries.nodeOwner()?.name ?? null);
  protected readonly refinementColour: Signal<string> = computed(() => this.nodePanel()?.colour() ?? 'var(--color-base-content)');
  protected readonly isAnnotation: Signal<boolean> = computed(
    (): boolean =>
      this.workspace.queries.currentNode()?.id === RAMEN_ELEMENT.ANNOTATION ||
      this.workspace.queries.currentNodeChain().some((base): boolean => base.node.id === RAMEN_ELEMENT.ANNOTATION),
  );

  protected readonly attribute: Signal<Attribute | undefined> = computed(() =>
    this.workspace.queries.currentNode()?.attributes.find((attribute) => attribute.id === this.editing.current()?.attributeId),
  );

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.lifetime.abort();
    });
    effect((): void => {
      if (!this.editing.changingNode() && !this.editing.current()) this.editing.close();
    });
  }

  protected changeSection(section: 'properties' | 'shapes'): void {
    if (section === 'shapes' && !this.editing.annotationEditingEnabled) return;
    if (this.editing.section() === section) return;
    this.runWithCleanDraft((): Promise<void> => this.activateSection(section));
  }

  protected async handleTabKey(event: KeyboardEvent): Promise<void> {
    if (
      !this.editing.annotationEditingEnabled ||
      !this.isAnnotation() ||
      !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
    )
      return;
    event.preventDefault();
    if (!this.canRunAction()) return;
    let section: 'properties' | 'shapes' = this.editing.section() === 'properties' ? 'shapes' : 'properties';
    if (event.key === 'Home') section = 'properties';
    if (event.key === 'End') section = 'shapes';
    await this.activateSection(section);
    if (this.destroyRef.destroyed) return;
    afterNextRender(
      (): void => {
        if (!this.destroyRef.destroyed)
          this.element.nativeElement.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
      },
      { injector: this.injector },
    );
  }

  private async activateSection(section: 'properties' | 'shapes'): Promise<void> {
    if (this.editing.section() === section || this.switchingSection()) return;
    this.switchingSection.set(true);
    try {
      this.lifetime.signal.throwIfAborted();
      this.initialArrival.set(false);
      this.editing.section.set(section);
      await this.waitForRender();
      this.lifetime.signal.throwIfAborted();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.projects.reportError(error);
    } finally {
      this.switchingSection.set(false);
    }
  }

  public close(): void {
    this.runWithCleanDraft((): void => this.editing.close());
  }

  protected async save(): Promise<void> {
    if (this.actionPending()) return;
    const activeElement: Element | null = this.element.nativeElement.ownerDocument.activeElement;
    const saved: boolean = (await this.form()?.commit()) !== false;
    if (this.destroyRef.destroyed) return;
    if (!saved) {
      this.focusDetail();
      return;
    }
    this.restoreEditingFocus(activeElement);
  }

  protected discard(): void {
    if (this.actionPending()) return;
    this.form()?.reset();
  }

  protected back(): void {
    if (this.editing.previous()) this.backToNode();
    else this.close();
  }

  public handleEscape(event: Event): void {
    if (this.dialogs.current()) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.switchingSection()) return;
    if (this.sorting()) this.cancelSorting();
    else this.close();
  }

  protected select(attributeId: string | null): void {
    if (this.sorting()) {
      this.canRunAction();
      return;
    }
    if (attributeId !== null && attributeId === this.editing.current()?.attributeId && !this.inheritedSelection()) {
      this.detailVisible.set(true);
      this.focusDetail();
      return;
    }
    this.runWithCleanDraft((): void => this.selectOwnProperty(attributeId));
  }

  protected startSorting(): void {
    if (this.sorting() || !this.workspace.queries.nodeEditable() || this.properties().length < 2) return;
    if (!this.canRunAction()) return;
    this.orderDraft.set([...this.properties()]);
    afterNextRender((): void => this.orderList()?.focus(), { injector: this.injector });
  }

  protected cancelSorting(): void {
    if (this.actionPending()) return;
    this.orderDraft.set(null);
    this.focusOrderControl('[data-property-sort]');
  }

  protected async saveOrder(): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!nodeId || !context || !this.sorting() || !this.orderChanged() || this.actionPending()) return;
    const draft: readonly Attribute[] = this.sortedProperties();
    const ids: string[] = draft.map((property: Attribute): string => property.id);

    this.savingOrder.set(true);
    this.orderDraft.set(null);

    try {
      await this.workspace.actions.reorderAttributes(nodeId, ids);
    } catch (error: unknown) {
      if (this.isCurrentNode(context, nodeId)) {
        this.orderDraft.set(draft);
        this.projects.reportError(error);
      }
    } finally {
      this.savingOrder.set(false);
      if (this.isCurrentNode(context, nodeId)) {
        if (this.sorting()) afterNextRender((): void => this.orderList()?.focus(), { injector: this.injector });
        else this.focusOrderControl('[data-property-sort]');
      }
    }
  }

  protected updateOrder(items: readonly PropertyOrderItem[]): void {
    if (!this.sorting() || this.actionPending()) return;
    this.orderDraft.set(items.map((item: PropertyOrderItem): Attribute => item.attribute));
  }

  protected inspectRefinement(refinement: NodeDefinition): void {
    const projectId: string | undefined = this.workspace.context()?.projectId;
    const levelIndex: number | undefined = this.projects.recordsByModelId().get(refinement.modelId)?.levelIndex;
    if (!projectId || levelIndex === undefined) return;

    const location: WorkspaceLocation = { projectId, levelIndex, nodeId: refinement.node.id };
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.inspect(location)));
  }

  protected inspectNodeSource(location: WorkspaceLocation): void {
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.inspect(location)));
  }

  protected inspectPropertySource(property: InheritedAttribute): void {
    const projectId: string | undefined = this.workspace.context()?.projectId;
    if (!projectId) return;
    const location: WorkspaceLocation = { projectId, levelIndex: property.levelIndex, nodeId: property.nodeId };
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.inspect(location, property.attribute.id)));
  }

  protected backToNode(): void {
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.back()));
  }

  protected create(): void {
    this.runWithCleanDraft(async (): Promise<void> => {
      this.selectOwnProperty(null);
      await this.waitForRender();
      this.form()?.reset();
      this.focusDetail(true);
    });
  }

  protected selectInherited(property: InheritedAttribute): void {
    this.runWithCleanDraft((): void => {
      this.editing.select(property.attribute.id);
      this.detailVisible.set(true);
    });
  }

  protected backToList(): void {
    this.runWithCleanDraft((): void => this.detailVisible.set(false));
  }

  protected remove(property: Attribute): void {
    this.runWithCleanDraft((): void => {
      const nodeId: string | null = this.workspace.store.currentNodeId();
      const context: WorkspaceContext | null = this.workspace.context();
      if (!nodeId || !context) return;
      const options: ConfirmationOptions = {
        title: this.translations.translate('editor.removeProperty'),
        message: { key: 'editor.confirmRemoveProperty', params: { name: property.name } },
        buttons: [
          [
            { label: this.translations.translate('common.cancel') },
            {
              label: this.translations.translate('editor.removeProperty'),
              severity: 'error',
              click: (): Promise<void> => this.confirmRemoval(property, nodeId, context),
            },
          ],
        ],
      };
      this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
    });
  }

  protected duplicate(property: Attribute): void {
    this.runWithCleanDraft((): Promise<void> => this.duplicateProperty(property));
  }

  private async confirmRemoval(property: Attribute, nodeId: string, context: WorkspaceContext): Promise<void> {
    if (!this.isCurrentNode(context, nodeId)) return;

    const properties: readonly Attribute[] = this.properties();
    const index: number = properties.findIndex((item: Attribute): boolean => item.id === property.id);
    const nextId: string | undefined = properties[index + 1]?.id ?? properties[index - 1]?.id;

    await this.workspace.actions.removeAttribute(nodeId, property.id);
    if (!this.isCurrentNode(context, nodeId)) return;
    this.editing.select(nextId);
  }

  private focusOrderControl(selector: string): void {
    afterNextRender(
      (): void => {
        if (!this.destroyRef.destroyed) this.element.nativeElement.querySelector<HTMLElement>(selector)?.focus();
      },
      { injector: this.injector },
    );
  }

  private isCurrentNode(context: WorkspaceContext, nodeId: string): boolean {
    return !this.destroyRef.destroyed && this.workspace.isCurrent(context) && this.workspace.store.currentNodeId() === nodeId;
  }

  private async changeNode(action: () => Promise<boolean>): Promise<void> {
    if (this.actionPending()) return;
    this.switchingNode.set(true);
    try {
      this.lifetime.signal.throwIfAborted();
      const navigated: boolean = await action();
      this.lifetime.signal.throwIfAborted();
      if (navigated) this.detailVisible.set(true);
      await this.waitForRender();
      this.lifetime.signal.throwIfAborted();
      this.focusDetail();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.projects.reportError(error);
    } finally {
      this.switchingNode.set(false);
    }
  }

  private waitForRender(): Promise<void> {
    return new Promise((resolve): void => {
      const render: ReturnType<typeof afterNextRender> = afterNextRender(
        (): void => {
          unregister();
          resolve();
        },
        { injector: this.injector },
      );
      const unregister: () => void = this.destroyRef.onDestroy((): void => {
        render.destroy();
        resolve();
      });
    });
  }

  private async duplicateProperty(property: Attribute): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!nodeId || !context) return;

    await this.runPendingAction(async (): Promise<void> => {
      const copy: Attribute = await this.workspace.actions.duplicateAttribute(nodeId, property.id);
      if (this.destroyRef.destroyed || !this.workspace.isCurrent(context) || this.workspace.store.currentNodeId() !== nodeId)
        return;
      this.selectOwnProperty(copy.id);
      this.focusDetail(true);
    });
  }

  private async runPendingAction(action: () => Promise<void>): Promise<boolean> {
    await this.dialogs.run(action, { closeOnSuccess: false });
    const error: string | null = this.dialogs.error();
    if (!error) return true;
    this.projects.reportError(new Error(error));
    this.dialogs.error.set(null);
    return false;
  }

  private selectOwnProperty(attributeId: string | null): void {
    this.detailVisible.set(true);
    this.editing.select(attributeId);
  }

  private runWithCleanDraft(action: () => void | Promise<void>): void {
    if (this.canRunAction()) void this.runAction(action);
  }

  private canRunAction(): boolean {
    if (this.switchingSection() || this.actionPending() || this.shapeEditor()?.canLeave() === false) return false;
    if (this.sorting()) {
      this.element.nativeElement.querySelector<HTMLElement>('.property-list-footer button')?.focus();
      return false;
    }
    if (!this.inheritedSelection() && this.form()?.hasChanges()) {
      this.showDraftDecision();
      return false;
    }
    return true;
  }

  private showDraftDecision(): void {
    const options: ConfirmationOptions = {
      title: this.translations.translate('editor.propertyChanges'),
      message: { key: 'editor.unsavedChangesMessage', params: {} },
      buttons: [
        [
          { label: this.translations.translate('common.cancel') },
          { label: this.translations.translate('editor.discardChanges'), click: (): void => this.form()?.reset() },
          {
            label: this.translations.translate('common.save'),
            severity: 'primary',
            click: async (): Promise<void> => {
              await this.form()?.commit();
            },
          },
        ],
      ],
    };
    this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
  }

  private async runAction(action: () => void | Promise<void>): Promise<void> {
    try {
      await action();
      this.focusDetail();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.projects.reportError(error);
    }
  }

  private restoreEditingFocus(previous: Element | null): void {
    afterNextRender(
      (): void => {
        if (this.destroyRef.destroyed) return;
        const panel: HTMLElement | null = this.element.nativeElement.querySelector<HTMLElement>('.property-detail');
        const target: HTMLElement | null = previous instanceof HTMLElement && panel?.contains(previous) ? previous : panel;
        target?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  private focusDetail(selectName: boolean = false): void {
    if (this.destroyRef.destroyed) return;
    afterNextRender(
      (): void => {
        if (this.destroyRef.destroyed) return;
        const host: HTMLElement = this.element.nativeElement;
        if (!this.detailVisible() && window.matchMedia('(max-width: 640px)').matches) {
          const selected: HTMLElement | null =
            host.querySelector<HTMLElement>('.property-list button[aria-pressed="true"]') ??
            host.querySelector<HTMLElement>('.property-list button');
          selected?.focus();
          return;
        }
        const target: HTMLElement | null =
          host.querySelector<HTMLElement>('.property-detail [aria-invalid="true"]') ??
          host.querySelector<HTMLElement>('.property-detail input:not(:disabled)') ??
          host.querySelector<HTMLElement>('.property-detail');
        target?.focus();
        if (selectName && target instanceof HTMLInputElement) {
          queueMicrotask((): void => {
            if (!this.destroyRef.destroyed && target.ownerDocument.activeElement === target) target.select();
          });
        }
      },
      { injector: this.injector },
    );
  }
}
