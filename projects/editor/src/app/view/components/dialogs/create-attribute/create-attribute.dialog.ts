import { Component, effect, inject, input, InputSignal, signal, WritableSignal } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { Fieldset } from 'primeng/fieldset';
import { IftaLabel } from 'primeng/iftalabel';
import { InputText } from 'primeng/inputtext';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { SelectButton } from 'primeng/selectbutton';
import { Button } from 'primeng/button';
import { GAttribute, GDataType, TypeRef } from '../../../../core/models/GModel';
import { Builtins } from '../../../../core/validation/container/Builtins';
import { FormsModule } from '@angular/forms';
import { QualifiedParts, Reference } from '../../../../core/validation/container/Reference';
import { GModelFactory } from '../../../../core/GModelFactory';

interface Option<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-create-attribute',
  imports: [Fieldset, IftaLabel, InputText, AutoComplete, SelectButton, Button, FormsModule],
  templateUrl: './create-attribute.dialog.html',
  styleUrl: './create-attribute.dialog.scss',
})
export class CreateAttributeDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly selectOptions: Option<boolean>[] = [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ];

  protected readonly filteredDataTypeOptions: WritableSignal<Option<string>[]> = signal([]);
  protected readonly dataTypeOptions: WritableSignal<Option<string>[]> = signal([]);

  protected readonly draftAttribute: WritableSignal<GAttribute> = signal(GModelFactory.createAttribute());

  protected readonly isRequired: WritableSignal<boolean> = signal(false);
  protected readonly isReadOnly: WritableSignal<boolean> = signal(false);
  protected readonly isList: WritableSignal<boolean> = signal(false);

  public attribute: InputSignal<GAttribute | undefined> = input();

  constructor() {
    effect((): void => {
      const options: Option<string>[] = [];
      const builtinTypes: string[] = Array.from(Builtins.set);
      for (const type of builtinTypes) options.push({ label: type, value: type });

      const localTypes: GDataType[] = this.workspace.view.currentDataTypes();
      for (const type of localTypes) options.push({ label: type.name, value: type.id });

      const globalTypes: GDataType[] = this.workspace.view.globalDataTypes();
      for (const type of globalTypes) options.push({ label: type.name, value: type.id });

      this.dataTypeOptions.set(options);
      this.filteredDataTypeOptions.set(options);
    });

    effect((): void => {
      const attribute: GAttribute | undefined = this.attribute();
      if (attribute) this.draftAttribute.set(structuredClone(attribute));
    });
  }

  protected resolveTypeLabel(typeRef: TypeRef): string {
    if (!typeRef || typeRef === '') return '';

    if (Reference.isQualified(typeRef)) {
      const parts: QualifiedParts = Reference.splitQualified(typeRef);
      return this.workspace.view.resolveTypeLabel(parts.refId, parts.modelId);
    }

    const modelId: string | undefined = this.workspace.store.currentModel()?.id;
    return modelId ? this.workspace.view.resolveTypeLabel(typeRef, modelId) : '';
  }

  protected handleAutoComplete($event: AutoCompleteCompleteEvent): void {
    const options: Option<string>[] = this.dataTypeOptions().filter((option: Option<string>): boolean => {
      return option.label.toLowerCase().includes($event.query.trim().toLowerCase());
    });
    this.filteredDataTypeOptions.set(options);
  }
}
