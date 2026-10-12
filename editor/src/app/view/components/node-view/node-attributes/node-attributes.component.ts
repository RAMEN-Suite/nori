import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, type Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePencil, LucideTags } from '@lucide/angular';
import { RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import { Button, List, ListItemTemplate } from '@sushi-kit/angular';
import { DialogService, type DialogRef } from '../../../../services/dialog.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import type { NodeLevel } from '../../../../services/workspace/workspace.view';
import { EditAnnotationsDialog } from '../../dialogs/edit-annotations/edit-annotations.dialog';
import { EditPropertiesDialog } from '../../dialogs/edit-properties/edit-properties.dialog';
import { NodeAttributeComponent } from './node-attribute/node-attribute.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-attributes',
  imports: [TranslocoDirective, List, ListItemTemplate, NodeAttributeComponent, Button, LucidePencil, LucideTags],
  templateUrl: './node-attributes.component.html',
  styleUrl: './node-attributes.component.scss',
})
export class NodeAttributesComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly dialogs: DialogService = inject(DialogService);

  private dialogRef: DialogRef | null = null;

  protected readonly isAnnotation: Signal<boolean> = computed(
    (): boolean =>
      this.workspace.view.currentNode()?.id === RAMEN_ELEMENT.ANNOTATION ||
      this.workspace.view.currentNodeChain().some((base: NodeLevel): boolean => base.node.id === RAMEN_ELEMENT.ANNOTATION),
  );

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected handleEditProperties(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogs.open(EditPropertiesDialog, {
      headerKey: 'editor.editProperties',
    });
  }

  protected handleEditAnnotations(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogs.open(EditAnnotationsDialog, { headerKey: 'editor.editAnnotations' });
  }
}
