import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideArrowLeft,
  LucideBookOpen,
  LucideCopy,
  LucideEraser,
  LucideInfo,
  LucidePlus,
  LucideSave,
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
import {
  Badge,
  Button,
  Divider,
  Input,
  InputGroup,
  JoinItem,
  List,
  ListItemTemplate,
  Message,
  Popover,
  PopoverTrigger,
  type ListTrackBy,
} from '@sushi-kit/angular';
import { ScrollOverflowDirective } from '../../../../../directives/scroll-overflow.directive';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';
import { FieldValidationError } from '../../../../../models/FieldValidationError';
import type { InheritedAttribute } from '../../../../../models/WorkspaceDetails';
import type { WorkspaceLocation } from '../../../../../models/WorkspaceLocation';
import { DialogService } from '../../../../../services/interaction/dialog.service';
import { ProjectService } from '../../../../../services/projects/project.service';
import { WorkspaceService, type WorkspaceContext } from '../../../../../services/workspace/workspace.service';
import { groupBy } from '../../../../../utils/collections';
import { descriptionValue, isDescriptionValid } from '../../../../../utils/descriptions';
import { ConfirmationDialog, type ConfirmationOptions } from '../../../dialogs/confirmation/confirmation.dialog';
import { DescriptionFieldComponent } from '../../../shared/description-field/description-field.component';
import { ScrollHintsComponent } from '../../../shared/scroll-hints/scroll-hints.component';
import { NodeAttributeComponent } from '../../inspector/node-view/node-attributes/node-attribute/node-attribute.component';
import { PropertyFormComponent } from '../property-form/property-form.component';
import type { AnnotationPreset } from './annotation-vocabularies/annotation-vocabularies';
import { AnnotationVocabulariesComponent } from './annotation-vocabularies/annotation-vocabularies.component';
import { ShapeRelationFormComponent } from './shape-relation-form.component';

interface ShapeEntry {
  readonly shape: AnnotationShape;
  readonly modelId: string;
  readonly levelIndex: number;
  readonly modelName: string;
}

interface AnnotationSource {
  readonly name: string;
  readonly colour: string;
  readonly location: WorkspaceLocation;
}

interface ShapeGroup {
  readonly modelId: string;
  readonly modelName: string;
  readonly levelIndex: number;
  readonly entries: readonly ShapeEntry[];
}

/** The second window beside an annotation: one of its properties, a shared node property or a relation rule. */
type ShapeDetail = 'empty' | 'property' | 'shared' | 'relation';
type ShapeRemoval = 'shape' | 'property' | 'relation';
type LeaveScope = 'all' | 'detail';

/**
 * Owns the annotation list in the node column and the annotation windows beside it.
 * The annotation window keeps its name and description draft; the detail window reuses the property and relation forms.
 */
@Component({
  selector: 'nori-shape-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    TranslocoDirective,
    Badge,
    Button,
    Divider,
    Input,
    InputGroup,
    JoinItem,
    List,
    ListItemTemplate,
    Message,
    Popover,
    PopoverTrigger,
    ScrollOverflowDirective,
    ScrollHintsComponent,
    TooltipDirective,
    NodeAttributeComponent,
    PropertyFormComponent,
    ShapeRelationFormComponent,
    AnnotationVocabulariesComponent,
    DescriptionFieldComponent,
    LucideArrowLeft,
    LucideBookOpen,
    LucideCopy,
    LucideEraser,
    LucideInfo,
    LucidePlus,
    LucideSave,
    LucideTags,
    LucideUndo2,
    LucideX,
  ],
  templateUrl: './shape-editor.component.html',
  styleUrl: './shape-editor.component.scss',
})
export class ShapeEditorComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector: Injector = inject(Injector);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly form: Signal<PropertyFormComponent | undefined> = viewChild(PropertyFormComponent);
  protected readonly relationForm: Signal<ShapeRelationFormComponent | undefined> = viewChild(ShapeRelationFormComponent);

  /** Whether the annotation windows own the window area; the list stays visible either way. */
  public readonly active: InputSignal<boolean> = input(false);
  /** Lets the workspace resolve its own drafts before an annotation takes over the window area. */
  public readonly canActivate: InputSignal<() => boolean> = input((): boolean => true);
  public readonly switchingNode: InputSignal<boolean> = input(false);
  public readonly activated: OutputEmitterRef<void> = output();
  public readonly inspectSource: OutputEmitterRef<WorkspaceLocation> = output();
  public readonly inspectPropertySource: OutputEmitterRef<InheritedAttribute> = output();

  public readonly busy: WritableSignal<boolean> = signal(false);
  public readonly mobileDetail: WritableSignal<boolean> = signal(false);
  protected readonly nameError: WritableSignal<string | null> = signal(null);
  protected readonly search: WritableSignal<string> = signal('');
  protected readonly searchError: WritableSignal<string | null> = signal(null);
  protected readonly shapeId: WritableSignal<string | null> = signal(null);
  protected readonly creating: WritableSignal<boolean> = signal(false);
  protected readonly detail: WritableSignal<ShapeDetail> = signal('empty');
  protected readonly propertyId: WritableSignal<string | null> = signal(null);
  protected readonly shared: WritableSignal<InheritedAttribute | null> = signal(null);
  protected readonly relationIndex: WritableSignal<number> = signal(-1);
  protected readonly name: WritableSignal<string> = signal('');
  protected readonly description: WritableSignal<string> = signal('');
  private readonly initialDescription: WritableSignal<string> = signal('');
  private readonly initialName: WritableSignal<string> = signal('');

  protected readonly trackShape: ListTrackBy<ShapeEntry> = (_index: number, entry: ShapeEntry): string =>
    `${entry.modelId}:${entry.shape.id}`;
  protected readonly trackProperty: ListTrackBy<Attribute> = (_index: number, item: Attribute): string => item.id;
  protected readonly trackShared: ListTrackBy<InheritedAttribute> = (_index: number, item: InheritedAttribute): string =>
    `${item.modelId}:${item.attribute.id}`;
  protected readonly trackRule: ListTrackBy<AnnotationShapeRelation> = (index: number): number => index;

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
      })
      .sort((left: ShapeEntry, right: ShapeEntry): number =>
        left.shape.type.localeCompare(right.shape.type, undefined, { sensitivity: 'base', numeric: true }),
      );
  });
  protected readonly existingTypes: Signal<readonly string[]> = computed(() =>
    this.shapes().map((entry: ShapeEntry): string => entry.shape.type),
  );
  protected readonly filteredShapes: Signal<readonly ShapeEntry[]> = computed(() => {
    const query: string = this.search().trim().toLowerCase();
    return this.shapes().filter((entry: ShapeEntry): boolean =>
      `${entry.shape.type} ${entry.modelName}`.toLowerCase().includes(query),
    );
  });
  protected readonly shapeGroups: Signal<readonly ShapeGroup[]> = computed(() =>
    [...groupBy(this.filteredShapes(), (entry: ShapeEntry): string => entry.modelId)]
      .map(
        ([modelId, entries]): ShapeGroup => ({
          modelId,
          modelName: entries[0]?.modelName ?? '',
          levelIndex: entries[0]?.levelIndex ?? 0,
          entries,
        }),
      )
      .sort((left: ShapeGroup, right: ShapeGroup): number => left.levelIndex - right.levelIndex),
  );
  protected readonly searchMatch: Signal<ShapeEntry | undefined> = computed(() =>
    this.shapes().find((entry: ShapeEntry): boolean => entry.shape.type === this.search().trim()),
  );
  protected readonly selected: Signal<ShapeEntry | undefined> = computed(() =>
    this.shapes().find((item: ShapeEntry): boolean => item.shape.id === this.shapeId()),
  );
  private readonly sourceLocation: Signal<WorkspaceLocation | null> = computed(() => {
    const projectId: string | undefined = this.workspace.context()?.projectId;
    if (!projectId) return null;
    const property: InheritedAttribute | null = this.shared();
    if (property) return { projectId, levelIndex: property.levelIndex, nodeId: this.qualify(property.nodeId, property.modelId) };
    const entry: ShapeEntry | undefined = this.selected();
    if (!entry) return null;
    return { projectId, levelIndex: entry.levelIndex, nodeId: this.qualify(entry.shape.annotationId, entry.modelId) };
  });
  protected readonly source: Signal<AnnotationSource | null> = computed(() => {
    const location: WorkspaceLocation | null = this.sourceLocation();
    if (!location?.nodeId) return null;
    const node: Node | undefined = this.workspace.store.getDraft().getNode(location.nodeId);
    if (!node) return null;
    const base: string = ModelRef.localId(node.superTypes[0] ?? node.id);
    return { name: node.name, colour: this.workspace.store.currentNodeColors()[base] ?? 'var(--color-base-content)', location };
  });
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
  /** Local relation IDs that the selected annotation may set; the open rule narrows them to itself. */
  public readonly highlightedRelations: Signal<ReadonlySet<string>> = computed((): ReadonlySet<string> => {
    const shape: AnnotationShape | undefined = this.active() ? this.selected()?.shape : undefined;
    if (!shape) return new Set();
    const index: number = this.detail() === 'relation' ? this.relationIndex() : -1;
    const rules: readonly AnnotationShapeRelation[] = index >= 0 ? shape.relations.slice(index, index + 1) : shape.relations;
    return new Set(rules.flatMap((rule: AnnotationShapeRelation): string[] => rule.relationIds.map(ModelRef.localId)));
  });

  private readonly nodeContext: Signal<string> = computed(
    () => `${this.workspace.context()?.projectId}:${this.workspace.context()?.modelId}:${this.workspace.store.currentNodeId()}`,
  );

  public constructor() {
    effect((): void => {
      this.nodeContext();
      untracked((): void => {
        this.search.set('');
        this.closeShape();
      });
    });
  }

  /** Resolves unsaved annotation drafts; returns false while a decision is pending. */
  public canLeave(scope: LeaveScope = 'all'): boolean {
    if (this.pending()) return false;
    const changed: boolean = scope === 'all' ? this.hasChanges() : this.detailChanged();
    if (!changed) return true;
    const options: ConfirmationOptions = {
      title: this.translations.translate('editor.shapes.changes'),
      message: { key: 'editor.unsavedChangesMessage', params: {} },
      buttons: [
        [
          { label: this.translations.translate('common.cancel') },
          { label: this.translations.translate('editor.discardChanges'), click: (): void => this.discardChanges(scope) },
          {
            label: this.translations.translate('common.save'),
            severity: 'primary',
            click: (): Promise<void> => this.saveChanges(scope),
          },
        ],
      ],
    };
    this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
    return false;
  }

  protected hasChanges(): boolean {
    return this.settingsChanged() || this.detailChanged();
  }

  protected settingsChanged(): boolean {
    if (!this.selected() && !this.creating()) return false;
    return this.name().trim() !== this.initialName() || descriptionValue(this.description()) !== this.initialDescription();
  }

  protected detailChanged(): boolean {
    if (this.detail() === 'property') return this.form()?.hasChanges() ?? false;
    return this.detail() === 'relation' && (this.relationForm()?.hasChanges() ?? false);
  }

  protected open(entry: ShapeEntry): void {
    if (!this.takeOver()) return;
    this.showShape(entry.shape);
  }

  protected startCreate(): void {
    if (!this.takeOver()) return;
    this.shapeId.set(null);
    this.creating.set(true);
    this.clearDetail();
    this.loadSettings('', '');
    this.mobileDetail.set(true);
    this.focus('#annotation-name');
  }

  protected submitSearch(): void {
    const match: ShapeEntry | undefined = this.searchMatch();
    if (match) this.open(match);
    else if (this.search().trim()) void this.createFromSearch();
    else this.startCreate();
  }

  protected changeSearch(value: string): void {
    this.search.set(value);
    this.searchError.set(null);
  }

  protected clearSearch(event: Event): void {
    if (!this.search()) return;
    event.preventDefault();
    event.stopPropagation();
    this.changeSearch('');
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

  protected inspectOrigin(): void {
    const source: AnnotationSource | null = this.source();
    if (!source || !this.canLeave()) return;
    const property: InheritedAttribute | null = this.shared();
    if (property) this.inspectPropertySource.emit(property);
    else this.inspectSource.emit(source.location);
  }

  protected selectProperty(attributeId: string | null): void {
    if (!this.canLeave('detail')) return;
    this.clearDetail();
    this.propertyId.set(attributeId);
    this.detail.set('property');
    this.focus('.shape-detail-window input:not(:disabled), .shape-detail-window [role=combobox]');
  }

  protected selectShared(property: InheritedAttribute): void {
    if (!this.canLeave('detail')) return;
    this.clearDetail();
    this.shared.set(property);
    this.detail.set('shared');
    this.focus('.shape-detail-window');
  }

  protected selectRelation(index: number): void {
    if (!this.canLeave('detail')) return;
    this.clearDetail();
    this.relationIndex.set(index);
    this.detail.set('relation');
    this.focus('.shape-detail-window [role=combobox]');
  }

  protected closeDetail(): void {
    if (this.canLeave('detail')) this.clearDetail();
  }

  protected async saveSettings(): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    const type: string = this.name().trim();
    if (this.pending() || !this.editable() || !this.settingsChanged() || !nodeId || !context) return;
    if (!isDescriptionValid(this.description())) {
      this.focus('.shape-window textarea');
      return;
    }
    if (!type) {
      this.nameError.set(this.translations.translate('editor.shapes.nameRequired'));
      this.focus('#annotation-name');
      return;
    }
    await this.run(async (): Promise<void> => {
      const description: string = descriptionValue(this.description());
      const id: string | undefined = this.selected()?.shape.id;
      const shape: AnnotationShape = id
        ? await this.workspace.actions.updateAnnotationShape(id, { type, description })
        : await this.workspace.actions.createAnnotationShape({ nodeId, type, description });
      if (this.isCurrentNode(context, nodeId)) this.showShape(shape);
    });
  }

  protected async saveDetail(): Promise<void> {
    if (this.pending() || !this.editable() || !this.detailChanged()) return;
    if (this.detail() === 'property') await this.form()?.commit();
    else await this.relationForm()?.commit();
  }

  protected discardSettings(): void {
    this.nameError.set(null);
    this.name.set(this.initialName());
    this.description.set(this.initialDescription());
  }

  protected discardDetail(): void {
    if (this.detail() === 'relation') this.relationForm()?.reset();
    else this.form()?.reset();
  }

  protected async addVocabularyAnnotations(annotations: readonly AnnotationPreset[], popover: Popover): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!nodeId || !context || !annotations.length || !this.canLeave()) return;
    const missing: readonly AnnotationPreset[] = annotations.filter(
      (annotation: AnnotationPreset): boolean => !this.existingTypes().includes(annotation.type),
    );
    if (!missing.length) return;

    await this.run(async (): Promise<void> => {
      await this.workspace.actions.createAnnotationShapes(
        missing.map((annotation: AnnotationPreset) => ({ nodeId, ...annotation })),
      );
      if (this.isCurrentNode(context, nodeId)) popover.hide(true);
    });
  }

  protected requestRemoval(removal: ShapeRemoval): void {
    const shape: AnnotationShape | undefined = this.selected()?.shape;
    const context: WorkspaceContext | null = this.workspace.context();
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!shape || !context || !nodeId || !this.canLeave(removal === 'shape' ? 'all' : 'detail')) return;
    const options: ConfirmationOptions = {
      title: this.translations.translate('editor.shapes.removeAction'),
      message: { key: 'editor.shapes.remove.' + removal, params: {} },
      buttons: [
        [
          { label: this.translations.translate('common.cancel') },
          {
            label: this.translations.translate('editor.shapes.removeAction'),
            severity: 'error',
            click: (): Promise<void> => this.remove(removal, shape, context, nodeId),
          },
        ],
      ],
    };
    this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
  }

  protected async duplicateShape(): Promise<void> {
    const shape: AnnotationShape | undefined = this.selected()?.shape;
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!shape || !nodeId || !context || !this.canLeave()) return;
    await this.run(async (): Promise<void> => {
      const copy: AnnotationShape = await this.workspace.actions.createAnnotationShape({
        nodeId,
        type: this.availableCopyName(shape.type),
        description: shape.description,
        relations: shape.relations,
        properties: shape.properties.map(
          (property: Attribute): Attribute => ({
            ...property,
            id: ModelFactory.createIdentifier(),
            constraints: property.constraints?.map((constraint) => ({ ...constraint, id: ModelFactory.createIdentifier() })),
          }),
        ),
      });
      if (this.isCurrentNode(context, nodeId)) this.showShape(copy);
    });
  }

  protected savedProperty(id: string): void {
    this.propertyId.set(id);
    this.focus('.shape-detail-window input:not(:disabled)');
  }

  protected savedRelation(index: number): void {
    this.relationIndex.set(index);
    this.focus('.shape-detail-window [role=combobox]');
  }

  protected showList(): void {
    if (this.canLeave()) this.mobileDetail.set(false);
  }

  private takeOver(): boolean {
    if (!this.active() && !this.canActivate()()) return false;
    if (!this.canLeave()) return false;
    this.activated.emit();
    return true;
  }

  private showShape(shape: AnnotationShape): void {
    this.shapeId.set(shape.id);
    this.creating.set(false);
    this.clearDetail();
    this.loadSettings(shape.type, shape.description ?? '');
    this.mobileDetail.set(true);
    this.focus('#annotation-name');
  }

  private closeShape(): void {
    this.shapeId.set(null);
    this.creating.set(false);
    this.clearDetail();
    this.loadSettings('', '');
    this.mobileDetail.set(false);
  }

  private loadSettings(name: string, description: string): void {
    this.name.set(name);
    this.initialName.set(name);
    this.description.set(description);
    this.initialDescription.set(description);
    this.nameError.set(null);
  }

  private async createFromSearch(): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!nodeId || !context || !this.workspace.queries.editable() || !this.takeOver()) return;

    this.busy.set(true);
    try {
      const shape: AnnotationShape = await this.workspace.actions.createAnnotationShape({ nodeId, type: this.search().trim() });
      if (!this.isCurrentNode(context, nodeId)) return;
      this.changeSearch('');
      this.showShape(shape);
    } catch (error: unknown) {
      if (!this.isCurrentNode(context, nodeId)) return;
      if (error instanceof FieldValidationError && error.field === 'name') {
        this.searchError.set(error.message);
        this.focus('#annotation-search');
      } else this.projects.reportError(error);
    } finally {
      this.busy.set(false);
    }
  }

  private async saveChanges(scope: LeaveScope): Promise<void> {
    if (scope === 'all' && this.settingsChanged()) await this.saveSettings();
    if (this.detailChanged()) await this.saveDetail();
  }

  private discardChanges(scope: LeaveScope): void {
    if (scope === 'all') this.discardSettings();
    this.discardDetail();
  }

  private async remove(removal: ShapeRemoval, shape: AnnotationShape, context: WorkspaceContext, nodeId: string): Promise<void> {
    if (!this.isCurrentNode(context, nodeId)) return;
    if (removal === 'shape') await this.workspace.actions.removeAnnotationShape(shape.id);
    else if (removal === 'property') await this.workspace.actions.removeShapeProperty(shape.id, this.propertyId() ?? '');
    else {
      const index: number = this.relationIndex();
      await this.workspace.actions.updateAnnotationShape(shape.id, {
        relations: shape.relations.filter((_item: AnnotationShapeRelation, position: number): boolean => position !== index),
      });
    }
    if (!this.isCurrentNode(context, nodeId)) return;
    if (removal === 'shape') this.closeShape();
    else this.clearDetail();
  }

  private availableCopyName(type: string): string {
    const names: ReadonlySet<string> = new Set(this.existingTypes());
    const base: string = `${type.slice(0, 36)}Copy`;
    let name: string = base;
    for (let suffix: number = 2; names.has(name); suffix++) name = `${base.slice(0, 40 - String(suffix).length)}${suffix}`;
    return name;
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
          from: { ...relation.from, nodeId: this.qualify(relation.from.nodeId, ownerId) },
          to: { ...relation.to, nodeId: this.qualify(relation.to.nodeId, ownerId) },
        },
      ];
    });
  }

  private qualify(ref: string, modelId: string): string {
    return ModelRef.isQualified(ref) ? ref : ModelRef.qualify(modelId, ref);
  }

  private focus(selector: string): void {
    afterNextRender(
      (): void => {
        if (this.destroyRef.destroyed) return;
        const host: HTMLElement = this.element.nativeElement;
        (host.querySelector<HTMLElement>(selector) ?? host.querySelector<HTMLElement>('.shape-window'))?.focus();
      },
      { injector: this.injector },
    );
  }

  private isCurrentNode(context: WorkspaceContext, nodeId: string): boolean {
    return !this.destroyRef.destroyed && this.workspace.isCurrent(context) && this.workspace.store.currentNodeId() === nodeId;
  }

  private clearDetail(): void {
    this.detail.set('empty');
    this.propertyId.set(null);
    this.shared.set(null);
    this.relationIndex.set(-1);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    const context: WorkspaceContext | null = this.workspace.context();
    if (this.busy() || !context || !this.editable()) return;
    this.busy.set(true);
    this.nameError.set(null);
    try {
      await action();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || !this.workspace.isCurrent(context)) return;
      if (error instanceof FieldValidationError && error.field === 'name') {
        this.nameError.set(error.message);
        this.focus('#annotation-name');
      } else this.projects.reportError(error);
    } finally {
      this.busy.set(false);
    }
  }
}
