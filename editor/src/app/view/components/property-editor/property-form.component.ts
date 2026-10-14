import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  type OutputEmitterRef,
  type InputSignal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideSave, LucideX } from '@lucide/angular';
import { type Attribute, type AttributeInput, DataTypes, type DataTypeSuggestion } from '@ramen-suite/core/model';
import { Button, Input, Select, Toggle, type SelectOption } from '@sushi-kit/angular';
import { DialogService } from '../../../services/dialog.service';
import { WorkspaceService } from '../../../services/workspace/workspace.service';

@Component({
  selector: 'nori-property-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideSave, LucideX, TranslocoDirective, FormsModule, Button, Input, Select, Toggle],
  templateUrl: './property-form.component.html',
  styleUrl: './property-form.component.scss',
})
export class PropertyFormComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly dialogs: DialogService = inject(DialogService);
  public readonly pending: WritableSignal<boolean> = this.dialogs.pending;
  protected readonly error: WritableSignal<string | null> = signal<string | null>(null);
  public readonly modelSlot: InputSignal<number | null> = input<number | null>(null);
  public readonly editable: InputSignal<boolean> = input(true);
  public readonly saved: OutputEmitterRef<string> = output();
  public readonly completed: OutputEmitterRef<void> = output();
  public readonly currentAttribute: InputSignal<Attribute | undefined> = input();

  private initialValue: string = '';

  protected advanced: boolean = false;

  protected name: string = '';
  protected typeId: string = DataTypes.String;
  protected lowerBound: number = 0;
  protected upperBound: number = 1;
  protected isKey: boolean = false;
  protected isReadOnly: boolean = false;
  protected isUnique: boolean = true;
  protected isOrdered: boolean = false;
  protected readonly typeOptions: Signal<readonly SelectOption[]> = computed((): readonly SelectOption[] => {
    const options: SelectOption[] = this.workspace.view
      .dataTypeSuggestions()
      .map((type: DataTypeSuggestion): SelectOption => ({ label: type.name, value: type.ref }));
    const attribute: Attribute | undefined = this.currentAttribute();
    if (attribute && !options.some((option: SelectOption): boolean => option.value === attribute.typeId)) {
      options.unshift({
        value: attribute.typeId,
        label: this.workspace.view.resolveTypeLabel(attribute.typeId, this.modelSlot() ?? this.workspace.store.currentSlot()),
      });
    }
    return options;
  });

  protected readonly hasOtherKey: Signal<boolean> = computed((): boolean => {
    const own: readonly Attribute[] = this.workspace.view.currentNode()?.attributes ?? [];
    const inherited: readonly Attribute[] = [...this.workspace.view.inheritedAttributes().values()]
      .flat()
      .map((item) => item.attribute);
    return [...own, ...inherited].some(
      (attribute: Attribute): boolean => attribute.isKey === true && attribute.id !== this.currentAttribute()?.id,
    );
  });

  protected get required(): boolean {
    return this.lowerBound > 0;
  }
  protected get multiple(): boolean {
    return this.upperBound === -1 || this.upperBound > 1;
  }

  protected handleRequired(required: boolean): void {
    this.lowerBound = required ? Math.max(1, this.lowerBound) : 0;
    if (required && this.upperBound === 0) this.upperBound = 1;
    if (!required) this.isKey = false;
  }

  protected handleMultiple(multiple: boolean): void {
    this.upperBound = multiple ? -1 : 1;
    if (multiple) this.isKey = false;
    else this.lowerBound = Math.min(1, this.lowerBound);
  }

  protected handleBounds(): void {
    if (this.lowerBound !== 1 || this.upperBound !== 1) this.isKey = false;
  }

  public constructor() {
    effect((): void => this.reset());
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
    this.isKey = attribute.isKey ?? false;
    this.isReadOnly = attribute.isReadOnly ?? false;
    this.isUnique = attribute.isUnique ?? true;
    this.isOrdered = attribute.isOrdered ?? false;
    this.advanced = ![0, 1].includes(this.lowerBound) || ![1, -1].includes(this.upperBound);
    this.error.set(null);
    this.initialValue = JSON.stringify(this.values());
  }

  public hasChanges(): boolean {
    return JSON.stringify(this.values()) !== this.initialValue;
  }

  protected handleType(value: unknown): void {
    if (typeof value === 'string') this.typeId = value;
  }

  protected async handleSave(): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!nodeId || !this.name.trim() || !this.editable()) return;

    const existing: Attribute | undefined = this.currentAttribute();
    const input: AttributeInput = this.values();

    if (this.pending()) return;
    this.pending.set(true);
    this.error.set(null);
    try {
      if (existing)
        await this.workspace.actions.updateAttribute(nodeId, existing.id, {
          ...input,
          constraints: input.constraints ? [...input.constraints] : undefined,
        });
      else await this.workspace.actions.createAttribute(nodeId, input);
      const attribute: Attribute | undefined = this.workspace.view
        .currentNode()
        ?.attributes.find((item: Attribute): boolean => item.id === existing?.id || (!existing && item.name === input.name));
      if (attribute) {
        this.initialValue = JSON.stringify(this.values());
        this.saved.emit(attribute.id);
      }
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.pending.set(false);
    }
  }

  protected handleCancel(): void {
    if (!this.pending()) this.completed.emit();
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
