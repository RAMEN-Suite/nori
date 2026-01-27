import { Component, effect, inject, input, InputSignal, signal, WritableSignal } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { Fieldset } from 'primeng/fieldset';
import { IftaLabel } from 'primeng/iftalabel';
import { InputText } from 'primeng/inputtext';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { SelectButton } from 'primeng/selectbutton';
import { Button } from 'primeng/button';
import { Bounds, GAttribute, GDataType, TypeRef } from '../../../../core/models/GModel';
import { Builtins } from '../../../../core/validation/container/Builtins';
import { FormsModule } from '@angular/forms';
import { QualifiedParts, Reference } from '../../../../core/validation/container/Reference';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { Transformer } from '../../../../core/helper/Transformer';
import { NgClass } from '@angular/common';
import { Message } from 'primeng/message';
import { CreateAttributeInput } from '../../../../core/GModelFactory';
import { SemanticHelper } from '../../../../core/helper/SemanticHelper';

interface RenderedOption {
  label: string;
  icon: string;
  onCheck?: () => void;
  onUncheck?: () => void;
  isChecked: WritableSignal<boolean>;
  isDisabled?: WritableSignal<boolean>;
}

interface RenderedCategory {
  label: string;
  options: RenderedOption[];
  isVisible: WritableSignal<boolean>;
  isDisabled?: WritableSignal<boolean>;
}

type RenderedAttributes = Required<Pick<GAttribute, 'isUnique' | 'isOrdered' | 'isKey' | 'isReadOnly'>>;
type AttributeOptions = { [p in keyof RenderedAttributes]: WritableSignal<boolean> } & {
  isRequired: WritableSignal<boolean>;
  isList: WritableSignal<boolean>;
};

interface GenericOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-create-attribute',
  imports: [Fieldset, IftaLabel, InputText, AutoComplete, SelectButton, Button, FormsModule, NgClass, Message],
  templateUrl: './create-attribute.dialog.html',
  styleUrl: './create-attribute.dialog.scss',
})
export class CreateAttributeDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly dialogRef: DynamicDialogRef = inject(DynamicDialogRef);

  protected isSubmitted: boolean = false;

  protected readonly filteredDataTypeOptions: WritableSignal<GenericOption<string>[]> = signal([]);
  protected readonly dataTypeOptions: WritableSignal<GenericOption<string>[]> = signal([]);

  public currentAttribute: InputSignal<GAttribute | undefined> = input();
  protected draftAttribute: WritableSignal<GAttribute> = signal({
    name: '',
    typeId: '',
    bounds: { lowerBound: 0, upperBound: 1 },
  });

  protected readonly attributeOptions: AttributeOptions = {
    isKey: signal(false),
    isOrdered: signal(false),
    isReadOnly: signal(false),
    isRequired: signal(false),
    isUnique: signal(false),
    isList: signal(false),
  };

  protected readonly selectOptions: GenericOption<boolean>[] = [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ];

  protected readonly renderedOptions: RenderedCategory[] = [
    {
      label: 'Advanced Options',
      options: [
        {
          label: `Attribute is <span class="font-bold">required</span>?`,
          icon: 'pi-exclamation-circle',
          isChecked: this.attributeOptions.isRequired,
          onUncheck: (): void => {
            this.attributeOptions.isKey.set(false);
          },
        },
        {
          label: `Attribute is a <span class="font-bold">list</span>?`,
          icon: 'pi-list',
          isChecked: this.attributeOptions.isList,
          isDisabled: this.attributeOptions.isKey,
          onCheck: (): void => {
            this.attributeOptions.isKey.set(false);
          },
          onUncheck: (): void => {
            this.attributeOptions.isOrdered.set(false);
            this.attributeOptions.isUnique.set(false);
          },
        },
        {
          label: `Attribute is <span class="font-bold">read only</span>?`,
          icon: 'pi-pen-to-square',
          isChecked: this.attributeOptions.isReadOnly,
          isDisabled: this.attributeOptions.isKey,
        },
      ],
      isVisible: signal(true),
    },
    {
      label: 'Key Options',
      options: [
        {
          label: `Attribute is an <span class="font-bold">identifier</span>?`,
          icon: 'pi-key',
          isChecked: this.attributeOptions.isKey,
          onCheck: (): void => {
            this.attributeOptions.isRequired.set(true);
            this.attributeOptions.isList.set(false);
            this.attributeOptions.isOrdered.set(false);
            this.attributeOptions.isUnique.set(false);
            this.attributeOptions.isReadOnly.set(true);
          },
        },
      ],
      isVisible: this.attributeOptions.isRequired,
      isDisabled: this.attributeOptions.isList,
    },
    {
      label: 'List Options',
      options: [
        {
          label: `List is <span class="font-bold">ordered</span>?`,
          icon: 'pi-sort-alt',
          isChecked: this.attributeOptions.isOrdered,
          onCheck: (): void => {
            this.attributeOptions.isList.set(true);
            this.attributeOptions.isKey.set(false);
          },
        },
        {
          label: `Elements are <span class="font-bold">unique</span>?`,
          icon: 'pi-globe',
          isChecked: this.attributeOptions.isUnique,
          onCheck: (): void => {
            this.attributeOptions.isList.set(true);
            this.attributeOptions.isKey.set(false);
          },
        },
      ],
      isVisible: this.attributeOptions.isList,
      isDisabled: this.attributeOptions.isKey,
    },
  ];

  constructor() {
    effect((): void => this.registerDataTypesEffect());
    effect((): void => this.registerCurrentAttributeEffect());
  }

  protected registerDataTypesEffect(): void {
    const options: GenericOption<string>[] = [];

    const builtinTypes: string[] = Array.from(Builtins.set);
    for (const type of builtinTypes) options.push({ label: type, value: type });

    const localTypes: ReadonlyArray<GDataType> = this.workspace.view.currentDataTypes();
    for (const type of localTypes) options.push({ label: type.name, value: type.id });

    const globalTypes: GDataType[] = this.workspace.view.globalDataTypes();
    for (const type of globalTypes) options.push({ label: type.name, value: type.id });

    this.dataTypeOptions.set(options);
    this.filteredDataTypeOptions.set(options);
  }

  protected registerCurrentAttributeEffect(): void {
    const attribute: GAttribute | undefined = this.currentAttribute();
    if (!attribute) return;

    this.draftAttribute.set(structuredClone(attribute));
    this.attributeOptions.isKey.set(!!attribute.isKey);
    this.attributeOptions.isReadOnly.set(!!attribute.isReadOnly);
    this.attributeOptions.isUnique.set(!!attribute.isUnique);
    this.attributeOptions.isOrdered.set(!!attribute.isOrdered);

    const { lowerBound, upperBound } = attribute.bounds;
    const isList: boolean = upperBound > 1 || upperBound === SemanticHelper.UNBOUNDED;
    const isRequired: boolean = lowerBound === 1;

    this.attributeOptions.isList.set(isList);
    this.attributeOptions.isRequired.set(isRequired);
  }

  protected formatTypeLabel(typeRef: TypeRef): string {
    if (!typeRef) return '';

    if (Reference.isQualified(typeRef)) {
      const parts: QualifiedParts = Reference.splitQualified(typeRef);
      return this.workspace.view.resolveTypeLabel(parts.refId, parts.modelId);
    }

    const modelId: string | undefined = this.workspace.store.currentModel()?.id;
    return modelId ? this.workspace.view.resolveTypeLabel(typeRef, modelId) : '';
  }

  protected handleSelectOption(option: RenderedOption): void {
    if (option.isChecked() && option.onCheck !== undefined) return option.onCheck();
    else if (option.onUncheck !== undefined) return option.onUncheck();
  }

  protected handleAutoComplete($event: AutoCompleteCompleteEvent): void {
    const options: GenericOption<string>[] = this.dataTypeOptions().filter((option: GenericOption<string>): boolean => {
      return option.label.toLowerCase().includes($event.query.trim().toLowerCase());
    });
    this.filteredDataTypeOptions.set(options);
  }

  protected handleSelectType(typeId: TypeRef): void {
    this.draftAttribute.update((attribute: GAttribute): GAttribute => ({ ...attribute, typeId }));
  }

  protected handleTransformName(): void {
    if (this.draftAttribute().name.trim() === '') return;
    const transformed: string = Transformer.toPropertyName(this.draftAttribute().name);
    this.draftAttribute.update((a: GAttribute): GAttribute => ({ ...a, name: transformed }));
  }

  protected isNameValid(): boolean {
    const attributeName: string = this.draftAttribute().name.toLowerCase().trim();
    return attributeName.length > 0;
  }

  protected isUnique(): boolean {
    const currentAttribute: GAttribute | undefined = this.currentAttribute();
    if (currentAttribute && currentAttribute.name === this.draftAttribute().name) return true;

    const attributeName: string = this.draftAttribute().name.toLowerCase().trim();
    return !this.workspace.view.inheritedAttributeNames().has(attributeName);
  }

  protected isNotRole(): boolean {
    const attributeName: string = this.draftAttribute().name.toLowerCase().trim();
    const roleNames: ReadonlySet<string> = this.workspace.view.currentRelationRoles();
    return !roleNames.has(attributeName);
  }

  protected isTypeValid(): boolean {
    return !!this.draftAttribute().typeId;
  }

  protected isFormValid(): boolean {
    return this.isTypeValid() && this.isNotRole() && this.isNameValid() && this.isUnique();
  }

  protected handleCloseModal(): void {
    this.dialogRef.close();
  }

  protected async handleCreateAttribute(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    const currentNodeId: string | null = this.workspace.store.currentNodeId();
    if (!currentNodeId) return;

    const input: CreateAttributeInput = this.getCreateAttributeInput();
    void this.workspace.actions.createAttribute(currentNodeId, input);
    this.dialogRef.close();
  }

  protected handleUpdateAttribute(): void {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    const currentAttribute: GAttribute | undefined = this.currentAttribute();
    const currentNodeId: string | null = this.workspace.store.currentNodeId();
    if (!currentNodeId || !currentAttribute) return;

    const input: CreateAttributeInput = this.getCreateAttributeInput();
    void this.workspace.actions.updateAttribute(currentNodeId, currentAttribute.name, input);
    this.dialogRef.close();
  }

  private getCreateAttributeInput(): CreateAttributeInput {
    const bounds: Bounds = this.getAttributeBounds();
    return {
      ...this.draftAttribute(),
      isKey: this.attributeOptions.isKey(),
      isOrdered: this.attributeOptions.isOrdered(),
      isUnique: this.attributeOptions.isUnique(),
      isReadOnly: this.attributeOptions.isReadOnly(),
      bounds,
    };
  }

  private getAttributeBounds(): Bounds {
    const lowerBound: number = this.attributeOptions.isRequired() ? 1 : 0;
    const upperBound: number = this.attributeOptions.isList() ? SemanticHelper.UNBOUNDED : 1;
    return { lowerBound, upperBound };
  }
}
