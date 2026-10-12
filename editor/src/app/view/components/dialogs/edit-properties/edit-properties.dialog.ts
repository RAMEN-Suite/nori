import { ChangeDetectionStrategy, Component, effect, inject, signal, type WritableSignal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePlus } from '@lucide/angular';
import type { Attribute } from '@ramen-suite/core/model';
import { Button, List, ListItemTemplate } from '@sushi-kit/angular';
import { DialogService } from '../../../../services/dialog.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { NodeAttributeComponent } from '../../node-view/node-attributes/node-attribute/node-attribute.component';
import { CreateAttributeDialog } from '../create-attribute/create-attribute.dialog';

@Component({
  selector: 'app-edit-properties',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, List, ListItemTemplate, LucidePlus, NodeAttributeComponent, CreateAttributeDialog],
  templateUrl: './edit-properties.dialog.html',
})
export class EditPropertiesDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly nodeId: string | null = this.workspace.store.currentNodeId();
  private readonly modelId: string | undefined = this.workspace.store.currentModel()?.id;

  protected readonly mode: WritableSignal<'list' | 'edit' | 'remove'> = signal('list');
  protected readonly selected: WritableSignal<Attribute | undefined> = signal(undefined);

  public constructor() {
    effect((): void => {
      if (this.workspace.store.currentNodeId() !== this.nodeId || this.workspace.store.currentModel()?.id !== this.modelId)
        this.dialogs.close();
    });
  }

  protected handleEdit(attribute?: Attribute): void {
    this.selected.set(attribute);
    this.mode.set('edit');
  }

  protected handleConfirmRemoval(attribute: Attribute): void {
    this.selected.set(attribute);
    this.mode.set('remove');
  }

  protected handleBack(): void {
    this.selected.set(undefined);
    this.mode.set('list');
    this.dialogs.error.set(null);
  }

  protected async handleRemove(): Promise<void> {
    const attribute: Attribute | undefined = this.selected();
    const nodeId: string | null = this.nodeId;
    if (!attribute || !nodeId || !this.workspace.view.nodeEditable()) return;

    await this.dialogs.run((): Promise<void> => this.workspace.actions.removeAttribute(nodeId, attribute.id), {
      closeOnSuccess: false,
    });
    if (!this.dialogs.error()) this.handleBack();
  }
}
