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
import { CdkDrag, CdkDragHandle, CdkDragPreview, CdkDropList, moveItemInArray, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideArrowDownUp,
  LucideGripVertical,
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
import { ModelRef, type Attribute, type Node } from '@ramen-suite/core/model';
import { RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import { Button, Divider, Message, List, ListItemTemplate, type ListTrackBy } from '@sushi-kit/angular';
import { AnimateHeightDirective } from '../../../../directives/animate-height.directive';
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
import { ConfirmationContentComponent } from '../../dialogs/confirmation/confirmation-content/confirmation-content.component';
import { NodeAttributeComponent } from '../inspector/node-view/node-attributes/node-attribute/node-attribute.component';
import { NodeBasicsComponent } from '../inspector/node-view/node-basics/node-basics.component';
import { PropertyFormComponent } from './property-form/property-form.component';

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
    CdkDrag,
    CdkDragHandle,
    CdkDragPreview,
    CdkDropList,
    LucideGripVertical,
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
    NodeBasicsComponent,
    NodeAttributeComponent,
    AnimateHeightDirective,
    ScrollOverflowDirective,
    ScrollHintsComponent,
    TooltipDirective,
    ConfirmationContentComponent,
  ],
  templateUrl: './property-editor.component.html',
  styleUrl: './property-editor.component.scss',
})
export class PropertyEditorComponent {
  protected readonly editing: PropertyEditingService = inject(PropertyEditingService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly appearance: ApplicationState = inject(ApplicationState);
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector: Injector = inject(Injector);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  protected readonly form: Signal<PropertyFormComponent | undefined> = viewChild(PropertyFormComponent);

  protected readonly trackProperty: ListTrackBy<Attribute> = (_index: number, property: Attribute): string => property.id;
  protected readonly trackInheritedProperty: ListTrackBy<InheritedAttribute> = (
    _index: number,
    property: InheritedAttribute,
  ): string => `${property.modelId}:${property.attribute.id}`;

  protected readonly decisionRequired: WritableSignal<boolean> = signal(false);
  protected readonly switchingNode: WritableSignal<boolean> = signal(false);
  protected readonly detailVisible: WritableSignal<boolean> = signal(true);
  protected readonly removing: WritableSignal<Attribute | null> = signal(null);
  private readonly orderDraft: WritableSignal<readonly Attribute[] | null> = signal(null);
  private cardAnimation: Animation | null = null;
  private decisionAnimation: Animation | null = null;
  private readonly lifetime: AbortController = new AbortController();

  protected readonly panelMotion: Signal<boolean> = computed(
    () => this.appearance.state().animations && !this.switchingNode() && !this.editing.changingNode(),
  );

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
  protected readonly sortedProperties: Signal<readonly Attribute[]> = computed(() => this.orderDraft() ?? this.properties());
  protected readonly orderChanged: Signal<boolean> = computed(() =>
    this.sortedProperties().some((property: Attribute, index: number): boolean => property.id !== this.properties()[index]?.id),
  );
  protected readonly controlsUnavailable: Signal<boolean> = computed(
    () => this.dialogs.pending() || this.editing.changingNode() || this.switchingNode(),
  );
  protected readonly actionPending: Signal<boolean> = computed(() => this.controlsUnavailable() || !!this.form()?.saving());

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
  protected readonly refinement: Signal<NodeDefinition | null> = computed(
    () => this.workspace.queries.currentNodeChain().at(-1) ?? null,
  );
  protected readonly refinementColour: Signal<string> = computed(() => {
    const node: Node | undefined = this.refinement()?.node;
    if (!node) return 'var(--color-base-content)';
    const base: string = ModelRef.localId(node.superTypes[0] ?? node.id);
    return this.workspace.store.currentNodeColors()[base] ?? 'var(--color-base-content)';
  });
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
      this.cardAnimation?.cancel();
      this.decisionAnimation?.cancel();
    });
    effect((): void => {
      if (!this.editing.changingNode() && !this.editing.current()) this.editing.close();
    });
  }

  public close(): void {
    this.runWithCleanDraft((): void => this.editing.close());
  }

  protected async save(): Promise<void> {
    if (this.actionPending()) return;
    const saved: boolean = (await this.form()?.commit()) !== false;
    if (this.destroyRef.destroyed) return;
    if (!saved) {
      this.focusDetail();
      return;
    }
    this.clearDecision();
  }

  protected discard(): void {
    if (this.actionPending()) return;
    this.form()?.reset();
    this.clearDecision();
  }

  protected back(): void {
    if (this.editing.previous()) this.backToNode();
    else this.close();
  }

  public handleEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.sorting()) this.cancelSorting();
    else if (this.removing()) {
      if (!this.actionPending()) this.cancelRemoval();
    } else this.close();
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
    if (this.sorting() || !this.workspace.queries.nodeEditable() || this.properties().length < 2 || this.removing()) return;
    if (!this.canRunAction()) return;
    this.orderDraft.set([...this.properties()]);
    this.focusOrderControl('.property-drag-handle');
  }

  protected cancelSorting(): void {
    if (this.actionPending()) return;
    this.orderDraft.set(null);
    this.decisionAnimation?.cancel();
    this.focusOrderControl('[data-property-sort]');
  }

  protected async saveOrder(): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!nodeId || !context || !this.sorting() || !this.orderChanged() || this.actionPending()) return;
    const ids: string[] = this.sortedProperties().map((property: Attribute): string => property.id);

    await this.dialogs.run(
      async (): Promise<void> => {
        await this.workspace.actions.reorderAttributes(nodeId, ids);
        if (!this.destroyRef.destroyed && this.workspace.isCurrent(context) && this.workspace.store.currentNodeId() === nodeId) {
          this.orderDraft.set(null);
          this.focusOrderControl('[data-property-sort]');
        }
      },
      { closeOnSuccess: false },
    );
  }

  protected dropProperty(event: CdkDragDrop<readonly Attribute[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.reorderProperty(event.previousIndex, event.currentIndex);
  }

  protected moveProperty(event: KeyboardEvent, property: Attribute): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    event.stopPropagation();
    const index: number = this.sortedProperties().findIndex((item: Attribute): boolean => item.id === property.id);
    this.reorderProperty(index, index + (event.key === 'ArrowUp' ? -1 : 1));
    this.focusOrderControl(`[data-property-order-id="${CSS.escape(property.id)}"]`);
  }

  protected inspectRefinement(): void {
    const refinement: NodeDefinition | null = this.refinement();
    const projectId: string | undefined = this.workspace.context()?.projectId;
    const levelIndex: number | undefined = refinement
      ? this.projects.recordsByModelId().get(refinement.modelId)?.levelIndex
      : undefined;
    if (!refinement || !projectId || levelIndex === undefined) return;

    const location: WorkspaceLocation = { projectId, levelIndex, nodeId: refinement.node.id };
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.inspect(location), -1));
  }

  protected inspectPropertySource(property: InheritedAttribute): void {
    const projectId: string | undefined = this.workspace.context()?.projectId;
    if (!projectId) return;
    const location: WorkspaceLocation = { projectId, levelIndex: property.levelIndex, nodeId: property.nodeId };
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.inspect(location, property.attribute.id), -1));
  }

  protected backToNode(): void {
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.back(), 1));
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
      this.selectOwnProperty(property.id);
      this.removing.set(property);
      this.focusDetail();
    });
  }

  protected duplicate(property: Attribute): void {
    this.runWithCleanDraft((): Promise<void> => this.duplicateProperty(property));
  }

  protected cancelRemoval(): void {
    if (this.actionPending()) return;
    this.removing.set(null);
    this.dialogs.error.set(null);
    this.focusDetail();
  }

  protected async confirmRemoval(): Promise<void> {
    const property: Attribute | null = this.removing();
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!property || !nodeId || !context || this.actionPending()) return;

    const properties: readonly Attribute[] = this.properties();
    const index: number = properties.findIndex((item: Attribute): boolean => item.id === property.id);
    const nextId: string | undefined = properties[index + 1]?.id ?? properties[index - 1]?.id;

    await this.dialogs.run((): Promise<void> => this.workspace.actions.removeAttribute(nodeId, property.id), {
      closeOnSuccess: false,
    });

    if (this.destroyRef.destroyed || !this.workspace.isCurrent(context) || this.workspace.store.currentNodeId() !== nodeId)
      return;
    if (!this.dialogs.error()) {
      this.removing.set(null);
      this.editing.select(nextId);
      this.focusDetail();
    }
  }

  private focusOrderControl(selector: string): void {
    afterNextRender(
      (): void => {
        if (!this.destroyRef.destroyed) this.element.nativeElement.querySelector<HTMLElement>(selector)?.focus();
      },
      { injector: this.injector },
    );
  }

  private reorderProperty(from: number, to: number): void {
    if (!this.sorting() || this.actionPending() || from < 0 || to < 0 || to >= this.sortedProperties().length) return;
    const properties: Attribute[] = [...this.sortedProperties()];
    moveItemInArray(properties, from, to);
    this.orderDraft.set(properties);
  }

  private async changeNode(action: () => Promise<boolean>, direction: 1 | -1): Promise<void> {
    if (this.actionPending() || this.removing()) return;
    this.switchingNode.set(true);
    try {
      await this.slideCard(0, direction * 64, 'leave');
      this.lifetime.signal.throwIfAborted();
      const navigated: boolean = await action();
      this.lifetime.signal.throwIfAborted();
      if (navigated) this.detailVisible.set(true);
      await this.waitForRender();
      this.lifetime.signal.throwIfAborted();
      await this.slideCard(navigated ? -direction * 64 : direction * 64, 0, 'enter');
      this.focusDetail();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.projects.reportError(error);
    } finally {
      this.cardAnimation?.cancel();
      this.cardAnimation = null;
      this.switchingNode.set(false);
    }
  }

  private async slideCard(from: number, to: number, phase: 'enter' | 'leave'): Promise<void> {
    if (!this.appearance.state().animations || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const surface: HTMLElement | null = this.element.nativeElement.querySelector('.property-workspace');
    if (!surface) return;

    this.cardAnimation?.cancel();
    this.cardAnimation = surface.animate(
      [
        { transform: `translateX(${from}px)`, opacity: phase === 'enter' ? 0 : 1 },
        { transform: `translateX(${to}px)`, opacity: phase === 'enter' ? 1 : 0 },
      ],
      { duration: phase === 'enter' ? 300 : 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
    );
    await this.cardAnimation.finished;
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

    await this.dialogs.run(
      async (): Promise<void> => {
        const copy: Attribute = await this.workspace.actions.duplicateAttribute(nodeId, property.id);
        if (this.destroyRef.destroyed || !this.workspace.isCurrent(context) || this.workspace.store.currentNodeId() !== nodeId)
          return;
        this.selectOwnProperty(copy.id);
        this.focusDetail(true);
      },
      { closeOnSuccess: false },
    );
  }

  private selectOwnProperty(attributeId: string | null): void {
    this.detailVisible.set(true);
    this.editing.select(attributeId);
  }

  private runWithCleanDraft(action: () => void | Promise<void>): void {
    if (this.canRunAction()) void this.runAction(action);
  }

  private canRunAction(): boolean {
    if (this.actionPending()) return false;
    if (this.sorting()) {
      this.element.nativeElement.querySelector<HTMLElement>('.property-list-footer button')?.focus();
      this.shakePanel('.property-list-footer');
      return false;
    }
    if (!this.inheritedSelection() && this.form()?.hasChanges()) {
      this.decisionRequired.set(true);
      this.element.nativeElement.querySelector<HTMLElement>('.property-save-actions button')?.focus();
      this.shakePanel('.property-save-panel');
      return false;
    }
    return true;
  }

  private shakePanel(selector: string): void {
    this.decisionAnimation?.cancel();
    if (!this.panelMotion() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const panel: HTMLElement | null = this.element.nativeElement.querySelector(selector);
    if (!panel) return;

    this.decisionAnimation = panel.animate(
      [0, -4, 4, -3, 3, -1, 0].map((distance: number): Keyframe => ({ transform: `translateX(${distance}px)` })),
      { duration: 320, easing: 'ease-in-out' },
    );
  }

  private clearDecision(): void {
    this.decisionRequired.set(false);
    this.decisionAnimation?.cancel();
  }

  private async runAction(action: () => void | Promise<void>): Promise<void> {
    try {
      await action();
      this.focusDetail();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.projects.reportError(error);
    }
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
          host.querySelector<HTMLElement>('[data-property-decision] button') ??
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
