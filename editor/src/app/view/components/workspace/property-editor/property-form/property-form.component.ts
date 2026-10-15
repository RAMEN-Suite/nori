import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import { TranslocoDirective } from '@jsverse/transloco';
import { type Attribute, type AttributeInput, DataTypes, type DataTypeSuggestion } from '@ramen-suite/core/model';
import {
  Card,
  Input,
  InputNumber,
  List,
  ListItemTemplate,
  Select,
  Toggle,
  type ListTrackBy,
  type SelectOption,
} from '@sushi-kit/angular';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { PROPERTY_NAME_MAX_LENGTH } from '../../../../../utils/model-names';

type PropertyToggleOption = 'required' | 'multiple' | 'ordered' | 'duplicates' | 'readonly' | 'key';
type PropertyOption = PropertyToggleOption | 'minimum' | 'maximum';

/** Applies property field changes serially while preserving newer edits and inline validation. */
@Component({
  selector: 'nori-property-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, TranslocoDirective, FormsModule, Card, Input, InputNumber, List, ListItemTemplate, Select, Toggle],
  templateUrl: './property-form.component.html',
  styleUrl: './property-form.component.scss',
})
export class PropertyFormComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  public readonly modelLevelIndex: InputSignal<number | null> = input<number | null>(null);
  public readonly editable: InputSignal<boolean> = input(true);
  public readonly saved: OutputEmitterRef<string> = output();
  public readonly currentAttribute: InputSignal<Attribute | undefined> = input();

  protected readonly trackOption: ListTrackBy<PropertyOption> = (_index: number, option: PropertyOption): string => option;

  protected readonly multipleOptions: readonly PropertyOption[] = ['minimum', 'maximum', 'ordered', 'duplicates'];
  protected readonly valueOptions: readonly PropertyOption[] = ['required', 'multiple'];

  protected readonly nameMaxLength: number = PROPERTY_NAME_MAX_LENGTH;

  protected readonly error: WritableSignal<string | null> = signal<string | null>(null);
  protected name: string = '';
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
  private saveRequested: boolean = false;
  private saving: Promise<void> | null = null;
  private readonly attributeSnapshot: Signal<string | undefined> = computed((): string | undefined =>
    JSON.stringify(this.currentAttribute()),
  );

  protected readonly typeOptions: Signal<readonly SelectOption[]> = computed((): readonly SelectOption[] => {
    const options: SelectOption[] = this.workspace.queries
      .dataTypeSuggestions()
      .map((type: DataTypeSuggestion): SelectOption => ({ label: type.name, value: type.ref }));
    const attribute: Attribute | undefined = this.currentAttribute();
    if (attribute && !options.some((option: SelectOption): boolean => option.value === attribute.typeId)) {
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
  protected readonly hasOtherKey: Signal<boolean> = computed((): boolean => {
    const own: readonly Attribute[] = this.workspace.queries.currentNode()?.attributes ?? [];
    const inherited: readonly Attribute[] = [...this.workspace.queries.inheritedAttributes().values()]
      .flat()
      .map((item) => item.attribute);
    return [...own, ...inherited].some(
      (attribute: Attribute): boolean => attribute.isKey === true && attribute.id !== this.currentAttribute()?.id,
    );
  });

  public constructor() {
    effect((): void => {
      this.attributeSnapshot();
      untracked((): void => {
        const sameSelection: boolean = this.currentAttribute()?.id === this.selectedAttributeId;
        if (!sameSelection || !this.hasChanges()) this.reset();
      });
    });
  }

  public reset(): void {
    const attribute: AttributeInput = this.currentAttribute() ?? {
      name: '',
      typeId: DataTypes.String,
      bounds: { lowerBound: 0, upperBound: 1 },
    };
    this.name = attribute.name;
    this.typeId = attribute.typeId;
    this.lowerBound = attribute.bounds?.lowerBound ?? 0;
    this.upperBound = attribute.bounds?.upperBound ?? 1;
    this.multipleEnabled.set(this.upperBound === -1 || this.upperBound > 1);
    this.isKey = attribute.isKey ?? false;
    this.isReadOnly = attribute.isReadOnly ?? false;
    this.isUnique = attribute.isUnique ?? true;
    this.isOrdered = attribute.isOrdered ?? false;
    this.selectedAttributeId = this.currentAttribute()?.id;
    this.error.set(null);
    this.initialValue = this.snapshot(this.values());
  }

  public hasChanges(): boolean {
    return this.snapshot(this.values()) !== this.initialValue;
  }

  public async commit(): Promise<boolean> {
    await this.handleSave();
    return !this.hasChanges();
  }

  protected get required(): boolean {
    return this.lowerBound > 0;
  }

  protected get multiple(): boolean {
    return this.multipleEnabled();
  }

  protected get usageOptions(): readonly PropertyOption[] {
    return this.lowerBound === 1 && this.upperBound === 1 && (!this.hasOtherKey() || this.isKey)
      ? ['readonly', 'key']
      : ['readonly'];
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

  protected handleOption(option: PropertyToggleOption, value: boolean): void {
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
    void this.handleSave();
  }

  protected handleMinimum(value: number | null): void {
    this.lowerBound = value ?? 0;
    this.handleBounds();
  }

  protected handleMaximum(value: number | null): void {
    this.upperBound = value ?? -1;
    this.handleBounds();
  }

  protected handleBounds(): void {
    if (this.lowerBound !== 1 || this.upperBound !== 1) this.isKey = false;
  }

  protected handleType(value: unknown): void {
    if (typeof value !== 'string' || !this.typeOptions().some((option: SelectOption): boolean => option.value === value)) return;
    this.typeId = value;
    void this.handleSave();
  }

  protected handleSave(): Promise<void> {
    if (this.saving) {
      this.saveRequested = true;
      return this.saving;
    }
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!nodeId || !this.editable() || !this.name.trim()) return Promise.resolve();
    if (!this.hasChanges()) {
      this.error.set(null);
      return Promise.resolve();
    }
    this.saving = this.saveCurrent(nodeId);
    return this.saving;
  }

  private handleRequired(required: boolean): void {
    this.lowerBound = required ? Math.max(1, this.lowerBound) : 0;
    if (required && this.upperBound === 0) this.upperBound = 1;
    if (!required) this.isKey = false;
    void this.handleSave();
  }

  private handleMultiple(multiple: boolean): void {
    this.multipleEnabled.set(multiple);
    this.upperBound = multiple ? -1 : 1;
    if (multiple) this.isKey = false;
    else this.lowerBound = Math.min(1, this.lowerBound);
    void this.handleSave();
  }

  private async saveCurrent(nodeId: string): Promise<void> {
    const existing: Attribute | undefined =
      this.currentAttribute() ??
      this.workspace.queries
        .currentNode()
        ?.attributes.find((attribute: Attribute): boolean => attribute.id === this.selectedAttributeId);
    const input: AttributeInput = this.values();
    this.saveRequested = false;
    this.error.set(null);
    try {
      const attribute: Attribute | undefined = await this.persist(nodeId, existing, input);
      this.initialValue = this.snapshot(input);
      if (!this.hasChanges()) this.syncMultipleMode();
      if (attribute && !existing) {
        this.selectedAttributeId = attribute.id;
        this.saved.emit(attribute.id);
      }
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving = null;
    }
    await this.flushRequestedSave();
  }

  private syncMultipleMode(): void {
    const multiple: boolean = this.upperBound === -1 || this.upperBound > 1;
    const host: HTMLElement = this.element.nativeElement;
    if (!multiple && host.ownerDocument.activeElement?.id === 'property-control-maximum') {
      host.querySelector<HTMLInputElement>('#property-control-multiple')?.focus();
    }
    this.multipleEnabled.set(multiple);
  }

  private async flushRequestedSave(): Promise<void> {
    if (this.saveRequested) await this.handleSave();
  }

  private async persist(nodeId: string, existing: Attribute | undefined, input: AttributeInput): Promise<Attribute | undefined> {
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
      typeId: this.typeId,
      bounds: { lowerBound: this.lowerBound, upperBound: this.upperBound },
      isKey: this.isKey,
      isReadOnly: this.isReadOnly,
      isUnique: this.isUnique,
      isOrdered: this.isOrdered,
      constraints: this.currentAttribute()?.constraints,
    };
  }
}
