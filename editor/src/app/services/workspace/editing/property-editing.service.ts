import { computed, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { DialogService, type DialogRef } from '../../interaction/dialog.service';
import { PropertyEditorComponent } from '../../../view/components/workspace/property-editor/property-editor.component';
import { WorkspaceService } from '../workspace.service';

interface PropertySelection {
  readonly modelId: string;
  readonly nodeId: string;
  readonly attributeId: string | null;
}

/** Owns the property-editing dialog and its current node/property selection. */
@Injectable({ providedIn: 'root' })
export class PropertyEditingService {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  private dialogRef: DialogRef | null = null;

  private readonly selection: WritableSignal<PropertySelection | null> = signal<PropertySelection | null>(null);

  public readonly current: Signal<PropertySelection | null> = computed((): PropertySelection | null => {
    const selection: PropertySelection | null = this.selection();
    if (!selection || !this.workspace.queries.nodeEditable()) return null;
    if (
      selection.modelId !== this.workspace.store.currentModel()?.id ||
      selection.nodeId !== this.workspace.store.currentNodeId()
    )
      return null;
    return selection;
  });

  public open(attributeId?: string | null): void {
    const modelId: string | undefined = this.workspace.store.currentModel()?.id;
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!modelId || !nodeId || !this.workspace.queries.nodeEditable()) return;
    this.select(attributeId);
    this.dialogRef = this.dialogs.open(PropertyEditorComponent, {
      header: this.translations.translate('editor.editPropertiesOf', { name: this.workspace.queries.currentNode()?.name }),
      width: '40rem',
    });
  }

  public select(attributeId?: string | null): void {
    const modelId: string | undefined = this.workspace.store.currentModel()?.id;
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!modelId || !nodeId) return;
    this.selection.set({
      modelId,
      nodeId,
      attributeId: attributeId === undefined ? (this.workspace.queries.currentNode()?.attributes[0]?.id ?? null) : attributeId,
    });
  }

  public close(): void {
    this.dialogRef?.close();
    this.dialogRef = null;
    this.selection.set(null);
  }
}
