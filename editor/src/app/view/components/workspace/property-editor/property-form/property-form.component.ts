import {
  ChangeDetectionStrategy,
  afterNextRender,
  Injector,
  Component,
  computed,
  effect,
  linkedSignal,
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
interface PropertyDraftValues {
  readonly name: string;
  readonly description: string;
  readonly typeId: string;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly isKey: boolean;
  readonly isReadOnly: boolean;
  readonly isUnique: boolean;
  readonly isOrdered: boolean;
  readonly constraints: AttributeInput['constraints'];
}

interface PropertyDraft {
  readonly values: PropertyDraftValues;
  readonly baseline: string;
  readonly attributeId: string | undefined;
}

/** Tracks property drafts reactively and commits valid edits through the workspace. */
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
  private readonly injector: Injector = inject(Injector);
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
  public readonly isSaving: WritableSignal<boolean> = signal(false);
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

  private readonly draft: WritableSignal<PropertyDraft> = linkedSignal({
    source: this.currentAttribute,
    computation: (attribute, previous): PropertyDraft => {
      const draft: PropertyDraft | undefined = previous?.value;
      if (draft && attribute?.id === draft.attributeId && this.snapshot(this.values(draft.values)) !== draft.baseline) {
        return draft;
      }
      return this.createDraft(attribute);
    },
  });
  protected readonly fieldErrors: WritableSignal<Readonly<Record<string, string>>> = linkedSignal({
    source: (): string | undefined => this.currentAttribute()?.id,
    computation: (): Readonly<Record<string, string>> => ({}),
  });
  protected readonly nameError: Signal<string | null> = computed(() => this.fieldErrors()['name'] ?? null);
  protected readonly name: Signal<string> = computed((): string => this.draft().values.name);
  protected readonly description: Signal<string> = computed((): string => this.draft().values.description);
  public readonly isDescriptionValid: Signal<boolean> = computed(() => isDescriptionValid(this.description()));
  protected readonly typeId: Signal<string> = computed((): string => this.draft().values.typeId);
  protected readonly lowerBound: Signal<number> = computed((): number => this.draft().values.lowerBound);
  protected readonly upperBound: Signal<number> = computed((): number => this.draft().values.upperBound);
  protected readonly isKey: Signal<boolean> = computed((): boolean => this.draft().values.isKey);
  protected readonly isReadOnly: Signal<boolean> = computed((): boolean => this.draft().values.isReadOnly);
  protected readonly isUnique: Signal<boolean> = computed((): boolean => this.draft().values.isUnique);
  protected readonly isOrdered: Signal<boolean> = computed((): boolean => this.draft().values.isOrdered);
  private autoSaveAttempt: string | null = null;

  /** The current attribute with unsaved form values, for live previews outside the form. */
  public readonly preview: Signal<Attribute | undefined> = computed((): Attribute | undefined => {
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
      if (!this.autoSave() || this.isSaving() || !this.isDescriptionValid()) return;
      const snapshot: string = this.snapshot(this.values());
      if (snapshot === this.draft().baseline) {
        this.autoSaveAttempt = null;
        return;
      }
      if (snapshot === this.autoSaveAttempt) return;
      this.autoSaveAttempt = snapshot;
      untracked((): void => this.submitRequested.emit());
    });
  }

  public reset(): void {
    this.autoSaveAttempt = null;
    this.draft.set(this.createDraft(this.currentAttribute()));
    this.fieldErrors.set({});
  }

  protected updateDraft<K extends keyof PropertyDraftValues>(field: K, value: PropertyDraftValues[K]): void {
    this.draft.update((draft: PropertyDraft): PropertyDraft => ({ ...draft, values: { ...draft.values, [field]: value } }));
  }

  public hasChanges(): boolean {
    return this.snapshot(this.values()) !== this.draft().baseline;
  }

  public async commit(): Promise<boolean> {
    await this.saveDraft();
    return !this.hasChanges();
  }

  protected readonly hasMultipleValues: Signal<boolean> = computed(() => this.upperBound() === -1 || this.upperBound() > 1);

  protected readonly boundOptions: Signal<readonly PropertyOption[]> = computed((): readonly PropertyOption[] => {
    if (!this.hasMultipleValues()) return this.singleOptions;
    if (this.hideDefinition() || !this.editable()) return this.multipleOptions;
    return this.multipleWithToggle;
  });

  protected readonly usageOptions: Signal<readonly PropertyOption[]> = computed((): readonly PropertyOption[] => {
    return this.hasMultipleValues() ? this.listUsageOptions : this.singleUsageOptions;
  });

  protected readonly isKeyUnavailable: Signal<boolean> = computed((): boolean => {
    return !!this.otherKey() || this.lowerBound() !== 1 || this.upperBound() !== 1;
  });

  protected optionDisabled(option: PropertyOption): boolean {
    if (!this.editable()) return true;
    if (option === 'key') return this.isKeyUnavailable();
    return this.isKey() && (option === 'multiple' || option === 'required');
  }

  protected optionValue(option: PropertyToggleOption): boolean {
    const values: Record<PropertyToggleOption, boolean> = {
      multiple: this.hasMultipleValues(),
      required: this.lowerBound() > 0,
      ordered: this.isOrdered(),
      duplicates: !this.isUnique(),
      readonly: this.isReadOnly(),
      key: this.isKey(),
    };
    return values[option];
  }

  protected clearFieldError(field: string): void {
    if (!this.fieldErrors()[field]) return;
    this.fieldErrors.update((errors: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
      Object.fromEntries(Object.entries(errors).filter(([key]): boolean => key !== field)),
    );
  }

  protected handleName(value: string): void {
    this.updateDraft('name', value);
    this.clearFieldError('name');
  }

  private toggleMultiple(enabled: boolean): void {
    if (this.isKey() || enabled === this.hasMultipleValues()) return;
    this.updateDraft('lowerBound', Math.min(this.lowerBound(), 1));
    this.updateDraft('upperBound', enabled ? -1 : 1);
    this.handleBounds();
  }

  protected handleOption(option: PropertyToggleOption, value: boolean): void {
    if (option === 'required') {
      if (this.isKey()) return;
      this.handleMinimum(value ? 1 : 0);
      return;
    }
    if (option === 'multiple') {
      this.toggleMultiple(value);
      return;
    }
    this.clearFieldError(option);
    switch (option) {
      case 'ordered':
        this.updateDraft('isOrdered', value);
        break;
      case 'duplicates':
        this.updateDraft('isUnique', !value);
        break;
      case 'readonly':
        this.updateDraft('isReadOnly', value);
        break;
      case 'key':
        this.updateDraft('isKey', value);
        break;
    }
  }

  protected handleMinimum(value: number | null): void {
    this.updateDraft('lowerBound', value ?? 0);
    this.handleBounds();
  }

  protected handleMaximum(value: number | null): void {
    this.updateDraft('upperBound', value ?? -1);
    this.handleBounds();
  }

  protected handleType(value: unknown): void {
    if (typeof value !== 'string' || !this.typeOptions().some((option: AutocompleteOption): boolean => option.value === value))
      return;
    this.updateDraft('typeId', value);
  }

  private handleBounds(): void {
    this.clearFieldError('maximum');
    this.clearFieldError('key');
    if (this.lowerBound() !== 1 || this.upperBound() !== 1) this.updateDraft('isKey', false);
  }

  private async saveDraft(): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!nodeId || !this.editable() || this.isSaving() || !this.hasChanges()) return;
    this.fieldErrors.set({});
    if (!this.isDescriptionValid()) {
      this.element.nativeElement.querySelector<HTMLTextAreaElement>('textarea')?.focus();
      return;
    }
    if (!this.name().trim()) {
      this.showError(new FieldValidationError('name', this.translations.translate('editor.propertyNameRequired')));
      return;
    }

    this.isSaving.set(true);
    try {
      await this.saveCurrent(nodeId);
    } finally {
      this.isSaving.set(false);
    }
  }

  private createDraft(attribute: Attribute | undefined): PropertyDraft {
    const values: PropertyDraftValues = attribute
      ? {
          name: attribute.name,
          description: attribute.description ?? '',
          typeId: attribute.typeId,
          lowerBound: attribute.bounds.lowerBound,
          upperBound: attribute.bounds.upperBound,
          isKey: attribute.isKey ?? false,
          isReadOnly: attribute.isReadOnly ?? false,
          isUnique: attribute.isUnique ?? true,
          isOrdered: attribute.isOrdered ?? false,
          constraints: attribute.constraints,
        }
      : {
          name: '',
          description: '',
          typeId: DataTypes.String,
          lowerBound: 0,
          upperBound: 1,
          isKey: false,
          isReadOnly: false,
          isUnique: true,
          isOrdered: false,
          constraints: undefined,
        };
    return { values, baseline: this.snapshot(this.values(values)), attributeId: attribute?.id };
  }

  private async saveCurrent(nodeId: string): Promise<void> {
    const context: WorkspaceContext | null = this.workspace.context();
    if (!context) return;
    const existing: Attribute | undefined = this.currentAttribute();
    const input: AttributeInput = this.values();

    try {
      const attribute: Attribute | undefined = await this.persist(nodeId, existing, input);
      if (!this.isCurrentForm(context, nodeId, existing?.id)) return;
      this.draft.update((draft: PropertyDraft): PropertyDraft => ({
        ...draft,
        baseline: this.snapshot(input),
        attributeId: attribute?.id ?? existing?.id,
      }));
      if (attribute && !existing) {
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
      afterNextRender(
        (): void => {
          this.element.nativeElement.querySelector<HTMLElement>('[aria-invalid=true]')?.focus();
        },
        { injector: this.injector },
      );
    }
    if (this.statusErrors()) {
      this.notifications.show({
        status: 'error',
        message: error instanceof Error ? error.message : this.translations.translate('common.notificationTitles.error'),
      });
    } else if (!(error instanceof FieldValidationError && this.hasField(error.field))) this.projects.reportError(error);
  }

  private hasField(field: string): boolean {
    return field === 'name' || field === 'key' || (field === 'maximum' && this.hasMultipleValues());
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

  private values(form: PropertyDraftValues = this.draft().values): AttributeInput {
    return {
      name: form.name.trim(),
      description: descriptionValue(form.description),
      typeId: form.typeId,
      bounds: { lowerBound: form.lowerBound, upperBound: form.upperBound },
      isKey: form.isKey,
      isReadOnly: form.isReadOnly,
      isUnique: form.isUnique,
      isOrdered: form.isOrdered,
      constraints: form.constraints,
    };
  }
}
