import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  type OutputEmitterRef,
  type InputSignal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { type Attribute, type AttributeInput, DataTypes, type DataTypeSuggestion } from '@ramen-suite/core/model';
import {
  Card,
  Input,
  InputNumber,
  List,
  ListItemTemplate,
  Autocomplete,
  Toggle,
  type ListTrackBy,
  type AutocompleteOption,
} from '@sushi-kit/angular';
import { FieldValidationError } from '../../../../../models/FieldValidationError';
import { NotificationService } from '../../../../../services/interaction/notification.service';
import { ProjectService } from '../../../../../services/projects/project.service';
import { WorkspaceService, type WorkspaceContext } from '../../../../../services/workspace/workspace.service';
import { descriptionValue, isDescriptionValid } from '../../../../../utils/descriptions';
import { DescriptionFieldComponent } from '../../../shared/description-field/description-field.component';
import { PROPERTY_NAME_MAX_LENGTH } from '../../../../../utils/model-names';

type PropertyToggleOption = 'multiple' | 'required' | 'ordered' | 'duplicates' | 'readonly' | 'key';
type PropertyOption = PropertyToggleOption | 'minimum' | 'maximum';
/** Keeps property edits local until an explicit save succeeds. */
@Component({
  selector: 'nori-property-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DescriptionFieldComponent,
    NgTemplateOutlet,
    TranslocoDirective,
    FormsModule,
    Card,
    Input,
    InputNumber,
    List,
    ListItemTemplate,
    Autocomplete,
    Toggle,
  ],
  templateUrl: './property-form.component.html',
  styleUrl: './property-form.component.scss',
})
export class PropertyFormComponent {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly changeDetector: ChangeDetectorRef = inject(ChangeDetectorRef);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  public readonly modelLevelIndex: InputSignal<number | null> = input<number | null>(null);
  public readonly shapeId: InputSignal<string | null> = input<string | null>(null);
  public readonly statusErrors: InputSignal<boolean> = input(false);
  public readonly autoSave: InputSignal<boolean> = input(false);
  public readonly hideDefinition: InputSignal<boolean> = input(false);
  public readonly editable: InputSignal<boolean> = input(true);
  public readonly saved: OutputEmitterRef<string> = output();
  public readonly submitRequested: OutputEmitterRef<void> = output();
  public readonly saving: WritableSignal<boolean> = signal(false);
  public readonly currentAttribute: InputSignal<Attribute | undefined> = input();

  protected readonly suggestionsMessage: (count: number) => string = (count: number): string =>
    this.translations.translate(count === 1 ? 'common.suggestionOne' : 'common.suggestionMany', { count });

  protected readonly trackOption: ListTrackBy<PropertyOption> = (_index: number, option: PropertyOption): string => option;

  private readonly singleOptions: readonly PropertyOption[] = ['multiple'];
  private readonly multipleOptions: readonly PropertyOption[] = ['minimum', 'maximum', 'ordered', 'duplicates'];
  private readonly multipleWithToggle: readonly PropertyOption[] = ['multiple', ...this.multipleOptions];
  private readonly listUsageOptions: readonly PropertyOption[] = ['readonly', 'key'];
  private readonly singleUsageOptions: readonly PropertyOption[] = ['required', ...this.listUsageOptions];

  protected readonly nameMaxLength: number = PROPERTY_NAME_MAX_LENGTH;

  protected readonly fieldErrors: WritableSignal<Readonly<Record<string, string>>> = signal({});
  protected readonly nameError: Signal<string | null> = computed(() => this.fieldErrors()['name'] ?? null);
  protected name: string = '';
  protected readonly description: WritableSignal<string> = signal('');
  public readonly descriptionValid: Signal<boolean> = computed(() => isDescriptionValid(this.description()));
  protected typeId: string = DataTypes.String;
  protected lowerBound: number = 0;
  protected upperBound: number = 1;
  protected isKey: boolean = false;
  protected isReadOnly: boolean = false;
  protected isUnique: boolean = true;
  protected isOrdered: boolean = false;

  private readonly revision: WritableSignal<number> = signal(0);

  private initialValue: string = '';
  private autoSaveAttempt: string | null = null;
  private selectedAttributeId: string | undefined;
  private constraints: AttributeInput['constraints'];
  private readonly attributeSnapshot: Signal<string | undefined> = computed((): string | undefined =>
    JSON.stringify(this.currentAttribute()),
  );

  /** The current attribute with unsaved form values, for live previews outside the form. */
  public readonly preview: Signal<Attribute | undefined> = computed((): Attribute | undefined => {
    this.revision();
    this.description();
    const attribute: Attribute | undefined = this.currentAttribute();
    if (!attribute) return undefined;
    const input: AttributeInput = this.values();
    return {
      ...attribute,
      ...input,
      name: input.name || attribute.name,
      typeId: input.typeId ?? attribute.typeId,
      bounds: input.bounds ?? attribute.bounds,
      constraints: attribute.constraints,
    };
  });
  protected readonly typeOptions: Signal<readonly AutocompleteOption[]> = computed((): readonly AutocompleteOption[] => {
    const options: AutocompleteOption[] = this.workspace.queries
      .dataTypeSuggestions()
      .map((type: DataTypeSuggestion): AutocompleteOption => ({ label: type.name, value: type.ref }));
    const attribute: Attribute | undefined = this.currentAttribute();
    if (attribute && !options.some((option: AutocompleteOption): boolean => option.value === attribute.typeId)) {
      options.unshift({
        value: attribute.typeId,
        label: this.workspace.queries.resolveTypeLabel(
          attribute.typeId,
          this.modelLevelIndex() ?? this.workspace.store.currentLevelIndex(),
        ),
      });
    }
    return options;
  });
  protected readonly otherKey: Signal<Attribute | undefined> = computed((): Attribute | undefined => {
    const own: readonly Attribute[] = this.workspace.queries.currentNode()?.attributes ?? [];
    const inherited: readonly Attribute[] = [...this.workspace.queries.inheritedAttributes().values()]
      .flat()
      .map((item) => item.attribute);
    return [...own, ...inherited].find(
      (attribute: Attribute): boolean => attribute.isKey === true && attribute.id !== this.currentAttribute()?.id,
    );
  });

  public constructor() {
    effect((): void => {
      this.attributeSnapshot();
      untracked((): void => {
        const sameSelection: boolean = this.currentAttribute()?.id === this.selectedAttributeId;
        if (!this.initialValue || !sameSelection || !this.hasChanges()) this.reset();
      });
    });
    effect((): void => {
      if (!this.autoSave() || this.saving() || !this.descriptionValid()) return;
      this.revision();
      const snapshot: string = this.snapshot(this.values());
      if (snapshot === this.initialValue) {
        this.autoSaveAttempt = null;
        return;
      }
      if (snapshot === this.autoSaveAttempt) return;
      this.autoSaveAttempt = snapshot;
      untracked((): void => this.submitRequested.emit());
    });
  }

  public reset(): void {
    const attribute: AttributeInput = this.currentAttribute() ?? {
      name: '',
      typeId: DataTypes.String,
      bounds: { lowerBound: 0, upperBound: 1 },
    };

    this.autoSaveAttempt = null;
    this.loadValues(attribute);
    this.selectedAttributeId = this.currentAttribute()?.id;
    this.fieldErrors.set({});
    this.initialValue = this.snapshot(this.values());
  }

  public hasChanges(): boolean {
    return this.snapshot(this.values()) !== this.initialValue;
  }

  public async commit(): Promise<boolean> {
    await this.saveDraft();
    return !this.hasChanges();
  }

  protected get multiple(): boolean {
    return this.upperBound === -1 || this.upperBound > 1;
  }

  protected get boundOptions(): readonly PropertyOption[] {
    if (!this.multiple) return this.singleOptions;
    if (this.hideDefinition() || !this.editable()) return this.multipleOptions;
    return this.multipleWithToggle;
  }

  protected get usageOptions(): readonly PropertyOption[] {
    return this.multiple ? this.listUsageOptions : this.singleUsageOptions;
  }

  protected get keyUnavailable(): boolean {
    return !!this.otherKey() || this.lowerBound !== 1 || this.upperBound !== 1;
  }

  protected optionDisabled(option: PropertyOption): boolean {
    if (!this.editable()) return true;
    if (option === 'key') return this.keyUnavailable;
    return this.isKey && (option === 'multiple' || option === 'required');
  }

  protected optionValue(option: PropertyToggleOption): boolean {
    const values: Record<PropertyToggleOption, boolean> = {
      multiple: this.multiple,
      required: this.lowerBound > 0,
      ordered: this.isOrdered,
      duplicates: !this.isUnique,
      readonly: this.isReadOnly,
      key: this.isKey,
    };
    return values[option];
  }

  protected clearFieldError(field: string): void {
    if (!this.fieldErrors()[field]) return;
    this.fieldErrors.update(
      (errors: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
        Object.fromEntries(Object.entries(errors).filter(([key]): boolean => key !== field)),
    );
  }

  protected handleName(): void {
    this.clearFieldError('name');
    this.markChanged();
  }

  private toggleMultiple(enabled: boolean): void {
    if (this.isKey || enabled === this.multiple) return;
    this.lowerBound = Math.min(this.lowerBound, 1);
    this.upperBound = enabled ? -1 : 1;
    this.handleBounds();
  }

  protected handleOption(option: PropertyToggleOption, value: boolean): void {
    if (option === 'required') {
      if (this.isKey) return;
      this.handleMinimum(value ? 1 : 0);
      return;
    }
    if (option === 'multiple') {
      this.toggleMultiple(value);
      return;
    }
    this.clearFieldError(option);
    this.markChanged();
    switch (option) {
      case 'ordered':
        this.isOrdered = value;
        break;
      case 'duplicates':
        this.isUnique = !value;
        break;
      case 'readonly':
        this.isReadOnly = value;
        break;
      case 'key':
        this.isKey = value;
        break;
    }
  }

  protected handleMinimum(value: number | null): void {
    this.lowerBound = value ?? 0;
    this.handleBounds();
  }

  protected handleMaximum(value: number | null): void {
    this.upperBound = value ?? -1;
    this.handleBounds();
  }

  protected handleType(value: unknown): void {
    if (typeof value !== 'string' || !this.typeOptions().some((option: AutocompleteOption): boolean => option.value === value))
      return;
    this.typeId = value;
    this.markChanged();
  }

  private handleBounds(): void {
    this.clearFieldError('maximum');
    this.clearFieldError('key');
    if (this.lowerBound !== 1 || this.upperBound !== 1) this.isKey = false;
    this.markChanged();
  }

  private markChanged(): void {
    this.revision.update((revision: number): number => revision + 1);
  }

  private async saveDraft(): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!nodeId || !this.editable() || this.saving() || !this.hasChanges()) return;
    this.fieldErrors.set({});
    if (!this.descriptionValid()) {
      this.element.nativeElement.querySelector<HTMLTextAreaElement>('textarea')?.focus();
      return;
    }
    if (!this.name.trim()) {
      this.showError(new FieldValidationError('name', this.translations.translate('editor.propertyNameRequired')));
      return;
    }

    this.saving.set(true);
    try {
      await this.saveCurrent(nodeId);
    } finally {
      this.saving.set(false);
    }
  }

  private loadValues(attribute: AttributeInput): void {
    this.name = attribute.name;
    this.description.set(attribute.description ?? '');
    this.typeId = attribute.typeId ?? DataTypes.String;
    this.lowerBound = attribute.bounds?.lowerBound ?? 0;
    this.upperBound = attribute.bounds?.upperBound ?? 1;
    this.isKey = attribute.isKey ?? false;
    this.isReadOnly = attribute.isReadOnly ?? false;
    this.isUnique = attribute.isUnique ?? true;
    this.isOrdered = attribute.isOrdered ?? false;
    this.constraints = attribute.constraints;
    this.markChanged();
    this.changeDetector.markForCheck();
  }

  private async saveCurrent(nodeId: string): Promise<void> {
    const context: WorkspaceContext | null = this.workspace.context();
    if (!context) return;
    const existing: Attribute | undefined = this.currentAttribute();
    const input: AttributeInput = this.values();

    try {
      const attribute: Attribute | undefined = await this.persist(nodeId, existing, input);
      if (!this.isCurrentForm(context, nodeId, existing?.id)) return;
      this.initialValue = this.snapshot(input);
      if (attribute && !existing) {
        this.selectedAttributeId = attribute.id;
        this.saved.emit(attribute.id);
      }
    } catch (error: unknown) {
      if (!this.isCurrentForm(context, nodeId, existing?.id)) return;
      this.showError(error);
    }
  }

  private showError(error: unknown): void {
    if (error instanceof FieldValidationError && this.hasField(error.field)) {
      this.fieldErrors.set({ [error.field]: error.message });
      this.changeDetector.detectChanges();
      this.element.nativeElement.querySelector<HTMLElement>('[aria-invalid=true]')?.focus();
    }
    if (this.statusErrors()) {
      this.notifications.show({
        status: 'error',
        message: error instanceof Error ? error.message : this.translations.translate('common.notificationTitles.error'),
      });
    } else if (!(error instanceof FieldValidationError && this.hasField(error.field))) this.projects.reportError(error);
  }

  private hasField(field: string): boolean {
    return field === 'name' || field === 'key' || (field === 'maximum' && this.multiple);
  }

  private isCurrentForm(context: WorkspaceContext, nodeId: string, attributeId: string | undefined): boolean {
    return (
      !this.destroyRef.destroyed &&
      this.workspace.isCurrent(context) &&
      this.workspace.store.currentNodeId() === nodeId &&
      this.currentAttribute()?.id === attributeId
    );
  }

  private async persist(nodeId: string, existing: Attribute | undefined, input: AttributeInput): Promise<Attribute | undefined> {
    const shapeId: string | null = this.shapeId();
    if (shapeId) return this.workspace.actions.saveShapeProperty(shapeId, input, existing?.id);
    if (existing) {
      await this.workspace.actions.updateAttribute(nodeId, existing.id, {
        ...input,
        constraints: input.constraints ? [...input.constraints] : undefined,
      });
      return this.workspace.queries
        .currentNode()
        ?.attributes.find((attribute: Attribute): boolean => attribute.id === existing.id);
    }
    return this.workspace.actions.createAttribute(nodeId, input);
  }

  private snapshot(input: AttributeInput): string {
    return JSON.stringify({ ...input, constraints: undefined });
  }

  private values(): AttributeInput {
    return {
      name: this.name.trim(),
      description: descriptionValue(this.description()),
      typeId: this.typeId,
      bounds: { lowerBound: this.lowerBound, upperBound: this.upperBound },
      isKey: this.isKey,
      isReadOnly: this.isReadOnly,
      isUnique: this.isUnique,
      isOrdered: this.isOrdered,
      constraints: this.constraints,
    };
  }
}
