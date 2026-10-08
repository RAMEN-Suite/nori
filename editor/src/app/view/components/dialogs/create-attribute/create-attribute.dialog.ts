import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  type InputSignal,
  type Signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button, Checkbox, Input, Select, type SelectOption } from '@sushi-kit/angular';
import { type Attribute, type AttributeInput, type DataTypeSuggestion, DataTypes } from '@ramen-suite/core/model';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { DialogService } from '../../../../services/dialog.service';

@Component({
  selector: 'app-create-attribute',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, Checkbox, Input, Select],
  templateUrl: './create-attribute.dialog.html',
  styleUrl: './create-attribute.dialog.scss',
})
export class CreateAttributeDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly dialogRef: DialogService = inject(DialogService);
  public readonly currentAttribute: InputSignal<Attribute | undefined> = input();

  protected name: string = '';
  protected typeId: string = DataTypes.String;
  protected lowerBound: number = 0;
  protected upperBound: number = 1;
  protected isKey: boolean = false;
  protected isReadOnly: boolean = false;
  protected isUnique: boolean = true;
  protected isOrdered: boolean = false;
  protected readonly typeOptions: Signal<readonly SelectOption[]> = computed((): readonly SelectOption[] =>
    this.workspace.view
      .dataTypeSuggestions()
      .map((type: DataTypeSuggestion): SelectOption => ({ label: type.name, value: type.ref })),
  );

  public constructor() {
    effect((): void => {
      const attribute: Attribute | undefined = this.currentAttribute();
      if (!attribute) return;

      this.name = attribute.name;
      this.typeId = attribute.typeId;
      this.lowerBound = attribute.bounds.lowerBound;
      this.upperBound = attribute.bounds.upperBound;
      this.isKey = attribute.isKey ?? false;
      this.isReadOnly = attribute.isReadOnly ?? false;
      this.isUnique = attribute.isUnique ?? true;
      this.isOrdered = attribute.isOrdered ?? false;
    });
  }

  protected handleType(value: unknown): void {
    if (typeof value === 'string') this.typeId = value;
  }

  protected async handleSave(): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!nodeId || !this.name.trim()) return;

    const existing: Attribute | undefined = this.currentAttribute();
    const input: AttributeInput = {
      name: this.name.trim(),
      typeId: this.typeId,
      bounds: { lowerBound: this.lowerBound, upperBound: this.upperBound },
      isKey: this.isKey,
      isReadOnly: this.isReadOnly,
      isUnique: this.isUnique,
      isOrdered: this.isOrdered,
      constraints: existing?.constraints,
    };

    await this.dialogRef.run(async (): Promise<void> => {
      if (existing)
        await this.workspace.actions.updateAttribute(nodeId, existing.id, { ...input, constraints: existing.constraints });
      else await this.workspace.actions.createAttribute(nodeId, input);
    });
  }
}
