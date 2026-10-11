import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, type InputSignal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideArrowUpRight, LucidePencil, LucideTrash } from '@lucide/angular';
import { type Attribute, type Bounds } from '@ramen-suite/core/model';
import { Badge, Button, Tooltip } from '@sushi-kit/angular';
import { type DialogRef, DialogService } from '../../../../../services/dialog.service';
import { NavigationService } from '../../../../../services/navigation.service';
import { StorageService } from '../../../../../services/storage.service';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { ConfirmationDialog, type ConfirmationOptions } from '../../../dialogs/confirmation/confirmation.dialog';
import { CreateAttributeDialog } from '../../../dialogs/create-attribute/create-attribute.dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-attribute',
  imports: [TranslocoDirective, Button, Tooltip, Badge, LucidePencil, LucideTrash, LucideArrowUpRight],
  templateUrl: './node-attribute.component.html',
  styleUrl: './node-attribute.component.scss',
})
export class NodeAttributeComponent {
  private readonly storage: StorageService = inject(StorageService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly dialogs: DialogService = inject(DialogService);

  private dialogRef: DialogRef | null = null;

  public readonly nodeId: InputSignal<string | undefined> = input();
  public readonly modelSlot: InputSignal<number> = input(0);
  public readonly attribute: InputSignal<Attribute | undefined> = input();

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected formatAttributeType(bounds: Bounds, typeName: string): string {
    const upper: string = bounds.upperBound === -1 ? '*' : String(bounds.upperBound);
    return `${typeName} · ${bounds.lowerBound}..${upper}`;
  }

  protected handleOpenUpdateAttribute(): void {
    const currentAttribute: Attribute | undefined = this.attribute();
    if (!currentAttribute) return;

    this.dialogRef?.close();
    this.dialogRef = this.dialogs.open(CreateAttributeDialog, {
      headerKey: 'editor.editProperty',
      inputValues: { currentAttribute },
    });
  }

  protected handleRemoveAttribute(): void {
    if (!this.workspace.view.nodeEditable()) return;
    const currentAttribute: Attribute | undefined = this.attribute();
    if (!currentAttribute) return;

    const currentNodeId: string | null = this.workspace.store.currentNodeId();
    if (!currentNodeId) return;

    const modelId: string | undefined = this.workspace.store.currentModel()?.id;
    const options: ConfirmationOptions = {
      title: this.translations.translate('editor.removePropertyTitle'),
      message: this.translations.translate('editor.confirmRemoveProperty', { name: currentAttribute.name }),
      buttons: [
        [
          { label: this.translations.translate('common.cancel'), severity: 'neutral' },
          {
            label: this.translations.translate('editor.removeProperty'),
            severity: 'error',
            click: async (): Promise<void> => {
              if (this.workspace.store.currentModel()?.id !== modelId)
                throw new Error(this.translations.translate('editor.modelChanged'));
              await this.workspace.actions.removeAttribute(currentNodeId, currentAttribute.id);
            },
          },
        ],
      ],
    };
    this.dialogRef = this.dialogs.open(ConfirmationDialog, { header: options.title, inputValues: { options } });
  }

  protected handleOpenQualifiedReference(): void {
    const slot: number = this.modelSlot();
    const nodeId: string | undefined = this.nodeId();
    if (!nodeId) return;

    void this.navigation.navigateToNode(slot, nodeId).catch((error: unknown): void => this.storage.reportError(error));
  }
}
