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
import { ProjectService } from '../../../../../services/projects/project.service';
import { WorkspaceService, type WorkspaceContext } from '../../../../../services/workspace/workspace.service';
import { descriptionValue, isDescriptionValid } from '../../../../../utils/descriptions';
import { DescriptionFieldComponent } from '../../../shared/description-field/description-field.component';
import { PROPERTY_NAME_MAX_LENGTH } from '../../../../../utils/model-names';

type PropertyToggleOption = 'required' | 'multiple' | 'ordered' | 'duplicates' | 'readonly' | 'key';
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
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  public readonly modelLevelIndex: InputSignal<number | null> = input<number | null>(null);
  public readonly shapeId: InputSignal<string | null> = input<string | null>(null);
  public readonly editable: InputSignal<boolean> = input(true);
  public readonly saved: OutputEmitterRef<string> = output();
  public readonly submitRequested: OutputEmitterRef<void> = output();
  public readonly saving: WritableSignal<boolean> = signal(false);
  public readonly currentAttribute: InputSignal<Attribute | undefined> = input();

  protected readonly trackOption: ListTrackBy<PropertyOption> = (_index: number, option: PropertyOption): string => option;

  protected readonly multipleOptions: readonly PropertyOption[] = ['minimum', 'maximum', 'ordered', 'duplicates'];
  protected readonly valueOptions: readonly PropertyOption[] = ['required', 'multiple'];
  protected readonly usageOptions: readonly PropertyOption[] = ['readonly', 'key'];

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

  private readonly multipleEnabled: WritableSignal<boolean> = signal(false);

  private initialValue: string = '';
  private selectedAttributeId: string | undefined;
  private constraints: AttributeInput['constraints'];
  private readonly attributeSnapshot: Signal<string | undefined> = computed((): string | undefined =>
    JSON.stringify(this.currentAttribute()),
  );

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
  }

  public reset(): void {
    const attribute: AttributeInput = this.currentAttribute() ?? {
      name: '',
      typeId: DataTypes.String,
      bounds: { lowerBound: 0, upperBound: 1 },
    };

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

  protected get required(): boolean {
    return this.lowerBound > 0;
  }

  protected get multiple(): boolean {
    return this.multipleEnabled();
  }

  protected get keyUnavailable(): boolean {
    return !!this.otherKey() || this.lowerBound !== 1 || this.upperBound !== 1;
  }

  protected optionValue(option: PropertyToggleOption): boolean {
    const values: Record<PropertyToggleOption, boolean> = {
      required: this.required,
      multiple: this.multiple,
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

  protected handleOption(option: PropertyToggleOption, value: boolean): void {
    this.clearFieldError(option);
    switch (option) {
      case 'required':
        return this.handleRequired(value);
      case 'multiple':
        return this.handleMultiple(value);
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
  }

  private handleBounds(): void {
    this.clearFieldError('maximum');
    this.clearFieldError('key');
    if (this.lowerBound !== 1 || this.upperBound !== 1) this.isKey = false;
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
      this.fieldErrors.set({ name: this.translations.translate('editor.propertyNameRequired') });
      this.element.nativeElement.querySelector<HTMLInputElement>('[name=name]')?.focus();
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
    this.multipleEnabled.set(this.upperBound === -1 || this.upperBound > 1);
    this.isKey = attribute.isKey ?? false;
    this.isReadOnly = attribute.isReadOnly ?? false;
    this.isUnique = attribute.isUnique ?? true;
    this.isOrdered = attribute.isOrdered ?? false;
    this.constraints = attribute.constraints;
    this.changeDetector.markForCheck();
  }

  private handleRequired(required: boolean): void {
    this.lowerBound = required ? Math.max(1, this.lowerBound) : 0;
    if (required && this.upperBound === 0) this.upperBound = 1;
    this.handleBounds();
  }

  private handleMultiple(multiple: boolean): void {
    this.multipleEnabled.set(multiple);
    this.upperBound = multiple ? -1 : 1;
    if (!multiple) this.lowerBound = Math.min(1, this.lowerBound);
    this.handleBounds();
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
      if (!this.hasChanges()) this.syncMultipleMode();
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
    } else this.projects.reportError(error);
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

  private syncMultipleMode(): void {
    const multiple: boolean = this.upperBound === -1 || this.upperBound > 1;
    const host: HTMLElement = this.element.nativeElement;
    if (!multiple && host.ownerDocument.activeElement?.id === 'property-control-maximum') {
      host.querySelector<HTMLInputElement>('#property-control-multiple')?.focus();
    }
    this.multipleEnabled.set(multiple);
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
