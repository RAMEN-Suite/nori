import { LucidePlus } from '@lucide/angular';
import { Component, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { Card, Button } from '@sushi-kit/angular';
import { NodeAttributeComponent } from './node-attribute/node-attribute.component';

import { CreateAttributeDialog } from '../../dialogs/create-attribute/create-attribute.dialog';
import { DialogService, DialogRef } from '../../../../services/dialog.service';
import { StorageService } from '../../../../services/storage.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-attributes',
  imports: [Card, NodeAttributeComponent, Button, LucidePlus],
  templateUrl: './node-attributes.component.html',
  styleUrl: './node-attributes.component.scss',
})
export class NodeAttributesComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly storage: StorageService = inject(StorageService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DialogRef | null = null;

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected handleOpenCreateAttribute(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(CreateAttributeDialog, {
      header: 'Add Attribute',
    });
  }
}
