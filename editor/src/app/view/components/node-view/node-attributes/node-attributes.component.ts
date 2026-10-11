import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePlus } from '@lucide/angular';
import { Button, List, ListItemTemplate } from '@sushi-kit/angular';
import { DialogService, type DialogRef } from '../../../../services/dialog.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { CreateAttributeDialog } from '../../dialogs/create-attribute/create-attribute.dialog';
import { NodeAttributeComponent } from './node-attribute/node-attribute.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-attributes',
  imports: [TranslocoDirective, List, ListItemTemplate, NodeAttributeComponent, Button, LucidePlus],
  templateUrl: './node-attributes.component.html',
  styleUrl: './node-attributes.component.scss',
})
export class NodeAttributesComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly dialogs: DialogService = inject(DialogService);

  private dialogRef: DialogRef | null = null;

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected handleOpenCreateAttribute(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogs.open(CreateAttributeDialog, {
      headerKey: 'editor.addProperty',
    });
  }
}
