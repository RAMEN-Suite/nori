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
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideEraser,
  LucideTrash,
  LucideCopy,
  LucidePencil,
  LucidePlus,
  LucideArrowLeft,
  LucideList,
  LucideTags,
  LucideShieldCheck,
  LucideX,
} from '@lucide/angular';
import { DataTypes, ModelRef, type Attribute, type Node } from '@ramen-suite/core/model';
import { RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import { Button, Divider, List, ListItemTemplate, type ListTrackBy } from '@sushi-kit/angular';
import { AnimateHeightDirective } from '../../../../directives/animate-height.directive';
import { ScrollOverflowDirective } from '../../../../directives/scroll-overflow.directive';
import { ScrollHintsComponent } from '../../shared/scroll-hints/scroll-hints.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import type { InheritedAttribute, NodeDefinition } from '../../../../models/WorkspaceDetails';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { ProjectService } from '../../../../services/projects/project.service';
import { PropertyEditingService } from '../../../../services/workspace/editing/property-editing.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import type { WorkspaceLocation } from '../../../../models/WorkspaceLocation';
import { ApplicationState } from '../../../../states/application.state';
import { groupBy } from '../../../../utils/collections';
import { ConfirmationContentComponent } from '../../dialogs/confirmation/confirmation-content/confirmation-content.component';
import { NodeAttributeComponent } from '../inspector/node-view/node-attributes/node-attribute/node-attribute.component';
import { NodeBasicsComponent } from '../inspector/node-view/node-basics/node-basics.component';
import { PropertyFormComponent } from './property-form/property-form.component';

interface InheritedPropertyGroup {
  readonly levelIndex: number;
  readonly modelName: string | null;
  readonly properties: readonly InheritedAttribute[];
}

/** Coordinates direct property editing, list selection and removal confirmation. */
@Component({
  selector: 'nori-property-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'handleEscape($event)' },
  imports: [
    LucidePencil,
    LucideX,
    TranslocoDirective,
    Button,
    Divider,
    List,
    ListItemTemplate,
    LucideTrash,
    LucideCopy,
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

  private readonly form: Signal<PropertyFormComponent | undefined> = viewChild(PropertyFormComponent);

  protected readonly trackProperty: ListTrackBy<Attribute> = (_index: number, property: Attribute): string => property.id;
  protected readonly trackInheritedProperty: ListTrackBy<InheritedAttribute> = (
    _index: number,
    property: InheritedAttribute,
  ): string => `${property.modelId}:${property.attribute.id}`;

  protected readonly detailVisible: WritableSignal<boolean> = signal(true);
  protected readonly inheritedSelection: Signal<InheritedAttribute | null> = computed(
    () =>
      [...this.workspace.queries.inheritedAttributes().values()]
        .flat()
        .find((property: InheritedAttribute): boolean => property.attribute.id === this.editing.current()?.attributeId) ?? null,
  );
  protected readonly removing: WritableSignal<Attribute | null> = signal(null);

  protected readonly properties: Signal<readonly Attribute[]> = computed(
    () => this.workspace.queries.currentNode()?.attributes ?? [],
  );
  protected readonly actionPending: Signal<boolean> = this.dialogs.pending;

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
    effect((): void => {
      if (!this.editing.current()) this.editing.close();
    });
  }

  public async close(): Promise<void> {
    if (this.actionPending()) return;
    await this.form()?.commit();
    this.editing.close();
  }

  public handleEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    void this.close();
  }

  protected select(attributeId: string | null): void {
    if (attributeId !== null && attributeId === this.editing.current()?.attributeId && !this.inheritedSelection()) {
      this.detailVisible.set(true);
      this.focusDetail();
      return;
    }
    void this.commitAndRun((): void => this.selectOwnProperty(attributeId));
  }

  protected inspectRefinement(): void {
    const refinement: NodeDefinition | null = this.refinement();
    const projectId: string | undefined = this.workspace.context()?.projectId;
    const levelIndex: number | undefined = refinement
      ? this.projects.recordsByModelId().get(refinement.modelId)?.levelIndex
      : undefined;
    if (!refinement || !projectId || levelIndex === undefined) return;

    const location: WorkspaceLocation = { projectId, levelIndex, nodeId: refinement.node.id };
    void this.commitAndRun((): Promise<void> => this.editing.inspect(location));
  }

  protected create(): void {
    void this.commitAndRun((): Promise<void> => this.createProperty(), true);
  }

  protected selectInherited(property: InheritedAttribute): void {
    void this.commitAndRun((): void => {
      this.editing.select(property.attribute.id);
      this.detailVisible.set(true);
    });
  }

  protected backToList(): void {
    void this.commitAndRun((): void => this.detailVisible.set(false));
  }

  protected remove(property: Attribute): void {
    void this.commitAndRun((): void => {
      this.selectOwnProperty(property.id);
      this.removing.set(property);
    });
  }

  protected duplicate(property: Attribute): void {
    void this.commitAndRun((): Promise<void> => this.duplicateProperty(property));
  }

  protected cancelRemoval(): void {
    this.removing.set(null);
    this.dialogs.error.set(null);
    this.focusDetail();
  }

  protected async confirmRemoval(): Promise<void> {
    const property: Attribute | null = this.removing();
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!property || !nodeId) return;

    await this.dialogs.run((): Promise<void> => this.workspace.actions.removeAttribute(nodeId, property.id), {
      closeOnSuccess: false,
    });

    if (!this.dialogs.error()) {
      this.removing.set(null);
      this.editing.select();
      this.focusDetail();
    }
  }

  private async createProperty(): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!nodeId) return;

    await this.dialogs.run(
      async (): Promise<void> => {
        const attribute: Attribute = await this.workspace.actions.createAttribute(nodeId, {
          name: this.workspace.actions.getAvailableAttributeName(nodeId, 'property'),
          typeId: DataTypes.String,
          bounds: { lowerBound: 0, upperBound: 1 },
        });
        this.selectOwnProperty(attribute.id);
      },
      { closeOnSuccess: false },
    );
  }

  private async duplicateProperty(property: Attribute): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!nodeId) return;

    await this.dialogs.run(
      async (): Promise<void> => {
        const copy: Attribute = await this.workspace.actions.duplicateAttribute(nodeId, property.id);
        this.selectOwnProperty(copy.id);
      },
      { closeOnSuccess: false },
    );
  }

  private selectOwnProperty(attributeId: string | null): void {
    this.detailVisible.set(true);
    this.editing.select(attributeId);
  }

  private async commitAndRun(action: () => void | Promise<void>, selectName: boolean = false): Promise<void> {
    if (this.actionPending()) return;
    const committed: boolean = this.inheritedSelection() ? true : (await this.form()?.commit()) !== false;
    if (this.destroyRef.destroyed || this.actionPending()) return;

    if (!committed) this.form()?.reset();
    await action();
    this.focusDetail(selectName);
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
          host.querySelector<HTMLElement>('.property-detail [data-property-decision] button') ??
          host.querySelector<HTMLElement>('.property-detail input:not(:disabled)') ??
          host.querySelector<HTMLElement>('.property-detail h3');
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
