import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  type InputSignal,
  type OnInit,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideSave, LucideX } from '@lucide/angular';
import { type Node } from '@ramen-suite/core/model';
import { Button, Input } from '@sushi-kit/angular';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { WorkspaceService, type WorkspaceContext } from '../../../../services/workspace/workspace.service';
import { descriptionValue, isDescriptionValid } from '../../../../utils/descriptions';
import { toPascalName } from '../../../../utils/model-names';
import { DescriptionFieldComponent } from '../../shared/description-field/description-field.component';

@Component({
  selector: 'nori-node-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoDirective, LucideSave, LucideX, Button, Input, DescriptionFieldComponent],
  templateUrl: './node-edit.dialog.html',
})
export class NodeEditDialog implements OnInit {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly context: WorkspaceContext | null = this.workspace.context();
  protected readonly dialogs: DialogService = inject(DialogService);

  public readonly node: InputSignal<Node> = input.required();
  public readonly reference: InputSignal<string> = input.required();
  public readonly editable: InputSignal<boolean> = input(false);

  protected readonly draftName: WritableSignal<string> = signal('');
  protected readonly draftDescription: WritableSignal<string> = signal('');
  protected readonly hasDuplicateName: Signal<boolean> = computed(() => {
    const name: string = toPascalName(this.draftName().trim());
    return this.workspace.queries
      .currentNodes()
      .some((entry: Node): boolean => entry.id !== this.node().id && entry.name === name);
  });
  protected readonly canSave: Signal<boolean> = computed(
    () =>
      this.editable() &&
      !this.dialogs.isPending() &&
      !!this.draftName().trim() &&
      this.draftName().length <= 40 &&
      !this.hasDuplicateName() &&
      isDescriptionValid(this.draftDescription()) &&
      (toPascalName(this.draftName().trim()) !== this.node().name ||
        descriptionValue(this.draftDescription()) !== (this.node().description ?? '')),
  );

  public ngOnInit(): void {
    this.draftName.set(this.node().name);
    this.draftDescription.set(this.node().description ?? '');
  }

  protected async save(): Promise<void> {
    const context: WorkspaceContext | null = this.context;
    if (!context || !this.workspace.isCurrent(context) || !this.canSave()) return;
    await this.dialogs.run((): Promise<void> =>
      this.workspace.actions.updateNode(this.reference(), {
        name: toPascalName(this.draftName().trim()),
        description: descriptionValue(this.draftDescription()),
      }),
    );
  }
}
