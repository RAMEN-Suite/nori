import {
  afterNextRender,
  Injector,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  untracked,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
  type Signal,
  type InputSignal,
  type OutputEmitterRef,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideArrowLeft,
  LucideChevronRight,
  LucideCopy,
  LucideEraser,
  LucideInfo,
  LucidePlus,
  LucideSave,
  LucideSettings2,
  LucideTags,
  LucideUndo2,
  LucideX,
} from '@lucide/angular';
import { ModelFactory, ModelRef, type Attribute, type Model, type Node, type Relation } from '@ramen-suite/core/model';
import {
  RamenModelFormat,
  type AnnotationShape,
  type AnnotationShapeRelation,
  type AnnotationShapeSuggestion,
} from '@ramen-suite/core/ramen';
import { Button, Divider, Input, List, ListItemTemplate, type ListTrackBy } from '@sushi-kit/angular';
import { ScrollOverflowDirective } from '../../../../../directives/scroll-overflow.directive';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';
import type { InheritedAttribute, NodeDefinition } from '../../../../../models/WorkspaceDetails';
import { ProjectService } from '../../../../../services/projects/project.service';
import { WorkspaceService, type WorkspaceContext } from '../../../../../services/workspace/workspace.service';
import { ApplicationState } from '../../../../../states/application.state';
import { ScrollHintsComponent } from '../../../shared/scroll-hints/scroll-hints.component';
import { NodeAttributeComponent } from '../../inspector/node-view/node-attributes/node-attribute/node-attribute.component';
import { NodeContextPanelComponent } from '../node-context-panel/node-context-panel.component';
import { PropertyFormComponent } from '../property-form/property-form.component';
import { ShapeRelationFormComponent } from './shape-relation-form.component';

interface ShapeEntry {
  readonly shape: AnnotationShape;
  readonly modelId: string;
  readonly levelIndex: number;
  readonly modelName: string;
}

type ShapeDetail = 'empty' | 'settings' | 'property' | 'shared' | 'relation';
type ShapeRemoval = 'shape' | 'property' | 'relation' | null;

@Component({
  selector: 'nori-shape-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslocoDirective,
    Button,
    Divider,
    Input,
    List,
    ListItemTemplate,
    ScrollOverflowDirective,
    ScrollHintsComponent,
    TooltipDirective,
    NodeContextPanelComponent,
    NodeAttributeComponent,
    PropertyFormComponent,
    ShapeRelationFormComponent,
    LucideArrowLeft,
    LucideChevronRight,
    LucideCopy,
    LucideEraser,
    LucideInfo,
    LucidePlus,
    LucideSave,
    LucideSettings2,
    LucideTags,
    LucideUndo2,
    LucideX,
  ],
  templateUrl: './shape-editor.component.html',
  styleUrls: ['../property-editor.component.scss', './shape-editor.component.scss'],
})
export class ShapeEditorComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector: Injector = inject(Injector);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly form: Signal<PropertyFormComponent | undefined> = viewChild(PropertyFormComponent);
  protected readonly relationForm: Signal<ShapeRelationFormComponent | undefined> = viewChild(ShapeRelationFormComponent);
  public readonly initialArrival: InputSignal<boolean> = input(false);
  public readonly switchingNode: InputSignal<boolean> = input(false);
  public readonly animateChanges: InputSignal<boolean> = input(true);
  public readonly inspectRefinement: OutputEmitterRef<NodeDefinition> = output();
  public readonly busy: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly shapeId: WritableSignal<string | null> = signal(null);
  protected readonly detail: WritableSignal<ShapeDetail> = signal('empty');
  protected readonly section: WritableSignal<'properties' | 'relations'> = signal('properties');
  protected readonly propertyId: WritableSignal<string | null> = signal(null);
  protected readonly shared: WritableSignal<InheritedAttribute | null> = signal(null);
  protected readonly relationIndex: WritableSignal<number> = signal(-1);
  protected readonly removing: WritableSignal<ShapeRemoval> = signal(null);
  protected readonly mobileDetail: WritableSignal<boolean> = signal(false);
  protected name: string = '';
  private initialName: string = '';
  private decisionAnimation: Animation | null = null;

  protected readonly trackShape: ListTrackBy<ShapeEntry> = (_index: number, item: ShapeEntry): string =>
    `${item.modelId}:${item.shape.id}`;
  protected readonly trackProperty: ListTrackBy<Attribute> = (_index: number, item: Attribute): string => item.id;
  protected readonly trackShared: ListTrackBy<InheritedAttribute> = (_index: number, item: InheritedAttribute): string =>
    `${item.modelId}:${item.attribute.id}`;

  protected readonly shapes: Signal<readonly ShapeEntry[]> = computed((): readonly ShapeEntry[] => {
    this.workspace.store.currentModel();
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!nodeId || !this.workspace.queries.validation()?.valid) return [];
    const models: readonly Model[] = this.workspace.store.getModels();
    return this.workspace.store
      .getDraft()
      .suggestAnnotationShapes(nodeId)
      .flatMap((suggestion: AnnotationShapeSuggestion): ShapeEntry[] => {
        const model: Model | undefined = models.find((item: Model): boolean => item.id === suggestion.modelId);
        const shape: AnnotationShape | undefined =
          model && RamenModelFormat.isDocument(model)
            ? model.annotations.find((item: AnnotationShape): boolean => item.id === suggestion.annotationId)
            : undefined;
        return shape
          ? [
              {
                shape,
                modelId: suggestion.modelId,
                levelIndex: this.projects.recordsByModelId().get(suggestion.modelId)?.levelIndex ?? 0,
                modelName: model?.name ?? '',
              },
            ]
          : [];
      });
  });
  protected readonly selected: Signal<ShapeEntry | undefined> = computed(() =>
    this.shapes().find((item: ShapeEntry): boolean => item.shape.id === this.shapeId()),
  );
  protected readonly editable: Signal<boolean> = computed(
    () =>
      this.workspace.queries.editable() &&
      (!this.selected() || this.selected()?.modelId === this.workspace.store.currentModel()?.id),
  );
  protected readonly attribute: Signal<Attribute | undefined> = computed(() =>
    this.selected()?.shape.properties.find((item: Attribute): boolean => item.id === this.propertyId()),
  );
  public readonly pending: Signal<boolean> = computed(
    () => this.busy() || !!this.form()?.saving() || !!this.relationForm()?.saving(),
  );
  protected readonly createLabel: Signal<string> = computed(() => {
    if (!this.selected()) return 'editor.shapes.create';
    return this.section() === 'properties' ? 'editor.addProperty' : 'editor.shapes.addRelation';
  });
  protected readonly saveLabel: Signal<string> = computed(() => {
    if (this.detail() === 'property') return this.attribute() ? 'editor.saveProperty' : 'editor.addProperty';
    if (this.detail() === 'relation') return 'editor.shapes.saveRelation';
    return this.selected() ? 'editor.shapes.save' : 'editor.shapes.create';
  });
  protected readonly sharedProperties: Signal<readonly InheritedAttribute[]> = computed(() => {
    const node: Node | null = this.workspace.queries.currentNode();
    const modelId: string = this.workspace.queries.nodeOwner()?.modelId ?? this.workspace.store.currentModel()?.id ?? '';
    return [
      ...[...this.workspace.queries.inheritedAttributes().values()].flat(),
      ...(node?.attributes ?? []).map(
        (attribute: Attribute): InheritedAttribute => ({
          attribute,
          modelId,
          nodeId: node?.id ?? '',
          nodeName: node?.name ?? '',
          levelIndex: this.workspace.queries.nodeOwner()?.levelIndex ?? 0,
        }),
      ),
    ];
  });

  private readonly nodeContext: Signal<string> = computed(
    () => `${this.workspace.context()?.projectId}:${this.workspace.context()?.modelId}:${this.workspace.store.currentNodeId()}`,
  );

  public constructor() {
    effect((): void => {
      this.nodeContext();
      untracked((): void => {
        this.shapeId.set(null);
        this.clearSelection();
      });
    });
    this.destroyRef.onDestroy((): void => this.decisionAnimation?.cancel());
  }

  public canLeave(): boolean {
    if (this.pending()) return false;
    if (!this.hasChanges()) return true;
    const panel: HTMLElement | null = this.element.nativeElement.querySelector('.property-save-panel');
    panel?.querySelector<HTMLButtonElement>('.property-save-actions button')?.focus();
    this.decisionAnimation?.cancel();
    if (this.appearance.state().animations && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.decisionAnimation =
        panel?.animate(
          [0, -4, 4, -3, 0].map((x: number): Keyframe => ({ transform: `translateX(${x}px)` })),
          { duration: 280 },
        ) ?? null;
    }
    return false;
  }

  protected hasChanges(): boolean {
    if (this.detail() === 'settings') return this.name.trim() !== this.initialName;
    if (this.detail() === 'property') return this.form()?.hasChanges() ?? false;
    return this.detail() === 'relation' && (this.relationForm()?.hasChanges() ?? false);
  }

  protected choose(entry: ShapeEntry): void {
    if (!this.canLeave()) return;
    this.shapeId.set(entry.shape.id);
    this.clearSelection();
    this.section.set('properties');
    this.mobileDetail.set(false);
    this.focus('.property-list button');
  }

  protected relationLabel(rule: AnnotationShapeRelation): string {
    return this.ruleRelations(rule)
      .map((relation: Relation): string => relation.name)
      .join(', ');
  }

  protected relationTargets(rule: AnnotationShapeRelation): string {
    const targets: string[] = this.ruleRelations(rule).map((relation: Relation): string => {
      const reference: string = rule.direction === 'outgoing' ? relation.to.nodeId : relation.from.nodeId;
      return this.workspace.queries.resolveNodeLabel(reference);
    });
    return `${rule.direction === 'outgoing' ? '→' : '←'} ${targets.join(', ')}`;
  }

  private ruleRelations(rule: AnnotationShapeRelation): readonly Relation[] {
    const modelId: string = this.selected()?.modelId ?? '';
    return rule.relationIds.flatMap((ref: string): Relation[] => {
      const qualified: string = ModelRef.isQualified(ref) ? ref : ModelRef.qualify(modelId, ref);
      const relation: Relation | undefined = this.workspace.store.getDraft().getRelation(qualified);
      if (!relation) return [];
      const ownerId: string = ModelRef.splitQualified(qualified).modelId;
      return [
        {
          ...relation,
          from: {
            ...relation.from,
            nodeId: this.qualify(relation.from.nodeId, ownerId),
          },
          to: {
            ...relation.to,
            nodeId: this.qualify(relation.to.nodeId, ownerId),
          },
        },
      ];
    });
  }

  private qualify(ref: string, modelId: string): string {
    return ModelRef.isQualified(ref) ? ref : ModelRef.qualify(modelId, ref);
  }

  protected backToShapes(): void {
    if (!this.canLeave()) return;
    this.shapeId.set(null);
    this.clearSelection();
    this.focus('.property-list button');
  }

  protected switchSection(section: 'properties' | 'relations'): void {
    if (!this.canLeave()) return;
    this.section.set(section);
    this.clearSelection();
  }

  protected createItem(): void {
    if (!this.selected()) this.settings(true);
    else if (this.section() === 'properties') this.selectProperty(null);
    else this.selectRelation(-1);
  }

  protected settings(create: boolean = false): void {
    if (!this.canLeave()) return;
    if (create) this.shapeId.set(null);
    this.clearSelection();
    this.name = this.selected()?.shape.type ?? '';
    this.initialName = this.name;
    this.detail.set('settings');
    this.mobileDetail.set(true);
    this.focus('.property-detail input:not(:disabled), .property-detail [role=combobox]');
  }

  protected selectProperty(attributeId: string | null): void {
    if (!this.canLeave()) return;
    this.clearSelection();
    this.propertyId.set(attributeId);
    this.detail.set('property');
    this.mobileDetail.set(true);
    this.focus('.property-detail input:not(:disabled), .property-detail [role=combobox]');
  }

  protected selectShared(property: InheritedAttribute): void {
    if (!this.canLeave()) return;
    this.clearSelection();
    this.shared.set(property);
    this.detail.set('shared');
    this.mobileDetail.set(true);
    this.focus('.property-detail input:not(:disabled), .property-detail [role=combobox]');
  }

  protected selectRelation(index: number): void {
    if (!this.canLeave()) return;
    this.clearSelection();
    this.relationIndex.set(index);
    this.detail.set('relation');
    this.mobileDetail.set(true);
    this.focus('.property-detail input:not(:disabled), .property-detail [role=combobox]');
  }

  protected async save(): Promise<void> {
    if (this.detail() === 'property') {
      await this.form()?.commit();
      this.focus('.property-detail input:not(:disabled)');
      return;
    }
    if (this.detail() === 'relation') {
      await this.relationForm()?.commit();
      this.focus('.property-detail [role=combobox]');
      return;
    }
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const type: string = this.name.trim();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!nodeId || !type || !context) return;
    await this.run(async (): Promise<void> => {
      const shape: AnnotationShape = this.selected()
        ? await this.workspace.actions.updateAnnotationShape(this.selected()?.shape.id ?? '', { type })
        : await this.workspace.actions.createAnnotationShape({ nodeId, type });
      if (!this.isCurrentNode(context, nodeId)) return;
      this.shapeId.set(shape.id);
      this.name = shape.type;
      this.initialName = shape.type;
      this.focus('.property-detail input:not(:disabled)');
    });
  }

  protected discard(): void {
    this.error.set(null);
    if (this.detail() === 'settings') this.name = this.initialName;
    else if (this.detail() === 'relation') this.relationForm()?.reset();
    else this.form()?.reset();
  }

  protected requestRemoval(removal: Exclude<ShapeRemoval, null>): void {
    if (this.canLeave()) this.removing.set(removal);
  }

  protected async confirmRemoval(): Promise<void> {
    const shape: AnnotationShape | undefined = this.selected()?.shape;
    const context: WorkspaceContext | null = this.workspace.context();
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!shape || !context || !nodeId) return;
    await this.run(async (): Promise<void> => {
      if (this.removing() === 'shape') {
        await this.workspace.actions.removeAnnotationShape(shape.id);
        if (this.isCurrentNode(context, nodeId)) this.shapeId.set(null);
      } else if (this.removing() === 'property') {
        await this.workspace.actions.removeShapeProperty(shape.id, this.propertyId() ?? '');
      } else
        await this.workspace.actions.updateAnnotationShape(shape.id, {
          relations: shape.relations.filter((_item, index: number): boolean => index !== this.relationIndex()),
        });
      if (this.isCurrentNode(context, nodeId)) this.clearSelection();
    });
  }

  protected async duplicateShape(): Promise<void> {
    const shape: AnnotationShape | undefined = this.selected()?.shape;
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!shape || !nodeId || !context || !this.canLeave()) return;
    const names: ReadonlySet<string> = new Set(this.shapes().map((item: ShapeEntry): string => item.shape.type));
    let type: string = `${shape.type}Copy`;
    while (names.has(type)) type += 'Copy';
    await this.run(async (): Promise<void> => {
      const properties: Attribute[] = shape.properties.map(
        (property: Attribute): Attribute => ({
          ...property,
          id: ModelFactory.createIdentifier(),
          constraints: property.constraints?.map((constraint) => ({
            ...constraint,
            id: ModelFactory.createIdentifier(),
          })),
        }),
      );
      const copy: AnnotationShape = await this.workspace.actions.createAnnotationShape({
        nodeId,
        type,
        properties,
        relations: shape.relations,
      });
      if (!this.isCurrentNode(context, nodeId)) return;
      this.shapeId.set(copy.id);
      this.name = copy.type;
      this.initialName = copy.type;
      this.focus('.property-detail input:not(:disabled)');
    });
  }

  protected savedProperty(id: string): void {
    this.propertyId.set(id);
    this.focus('.property-detail input:not(:disabled)');
  }

  protected savedRelation(index: number): void {
    this.relationIndex.set(index);
    this.focus('.property-detail [role=combobox]');
  }

  private focus(selector: string): void {
    afterNextRender(
      (): void => {
        if (!this.destroyRef.destroyed)
          (
            this.element.nativeElement.querySelector<HTMLElement>(selector) ??
            this.element.nativeElement.querySelector<HTMLElement>('.property-detail')
          )?.focus();
      },
      { injector: this.injector },
    );
  }

  protected showList(): void {
    if (this.canLeave()) this.mobileDetail.set(false);
  }

  public cancelRemoval(): boolean {
    if (!this.removing() || this.pending()) return false;
    this.removing.set(null);
    return true;
  }

  private isCurrentNode(context: WorkspaceContext, nodeId: string): boolean {
    return !this.destroyRef.destroyed && this.workspace.isCurrent(context) && this.workspace.store.currentNodeId() === nodeId;
  }

  private clearSelection(): void {
    this.detail.set('empty');
    this.propertyId.set(null);
    this.shared.set(null);
    this.relationIndex.set(-1);
    this.removing.set(null);
    this.error.set(null);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    const context: WorkspaceContext | null = this.workspace.context();
    if (this.busy() || !context || !this.editable()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed && this.workspace.isCurrent(context))
        this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy.set(false);
    }
  }
}
