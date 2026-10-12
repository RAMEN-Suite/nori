import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePencil, LucidePlus, LucideTrash } from '@lucide/angular';
import { ModelRef } from '@ramen-suite/core/model';
import type { RamenAnnotation } from '@ramen-suite/core/ramen';
import { Button, Input, List, ListItemTemplate, Tooltip } from '@sushi-kit/angular';
import { DialogService } from '../../../../services/dialog.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';

@Component({
  selector: 'app-edit-annotations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoDirective,
    FormsModule,
    Button,
    Input,
    List,
    ListItemTemplate,
    Tooltip,
    LucidePencil,
    LucidePlus,
    LucideTrash,
  ],
  templateUrl: './edit-annotations.dialog.html',
})
export class EditAnnotationsDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly nodeId: string | null = this.workspace.store.currentNodeId();
  private readonly modelId: string | undefined = this.workspace.store.currentModel()?.id;

  protected readonly mode: WritableSignal<'list' | 'edit' | 'remove'> = signal('list');
  protected readonly selected: WritableSignal<RamenAnnotation | undefined> = signal(undefined);
  protected readonly type: WritableSignal<string> = signal('');
  protected readonly annotations: Signal<readonly RamenAnnotation[]> = computed((): readonly RamenAnnotation[] => {
    this.workspace.store.currentModel();
    const modelId: string | undefined = this.modelId;
    if (!this.nodeId || !modelId) return [];

    const reference: string = ModelRef.isQualified(this.nodeId) ? this.nodeId : ModelRef.qualify(modelId, this.nodeId);
    return this.workspace.store
      .getDraft()
      .getAnnotations()
      .filter((annotation: RamenAnnotation): boolean => {
        const owner: string = ModelRef.isQualified(annotation.annotationId)
          ? annotation.annotationId
          : ModelRef.qualify(modelId, annotation.annotationId);
        return owner === reference;
      });
  });

  public constructor() {
    effect((): void => {
      if (this.workspace.store.currentNodeId() !== this.nodeId || this.workspace.store.currentModel()?.id !== this.modelId)
        this.dialogs.close();
    });
  }

  protected handleEdit(annotation?: RamenAnnotation): void {
    this.selected.set(annotation);
    this.type.set(annotation?.type ?? '');
    this.mode.set('edit');
  }

  protected handleConfirmRemoval(annotation: RamenAnnotation): void {
    this.selected.set(annotation);
    this.mode.set('remove');
  }

  protected handleBack(): void {
    this.mode.set('list');
    this.selected.set(undefined);
    this.dialogs.error.set(null);
  }

  protected async handleSave(): Promise<void> {
    const type: string = this.type().trim();
    const nodeId: string | null = this.nodeId;
    const current: RamenAnnotation | undefined = this.selected();
    if (!type || !nodeId || !this.workspace.view.editable()) return;

    await this.dialogs.run(
      async (): Promise<void> => {
        if (current) await this.workspace.actions.updateAnnotation(current.id, { type });
        else await this.workspace.actions.createAnnotation({ nodeId, type });
      },
      { closeOnSuccess: false },
    );
    if (!this.dialogs.error()) this.handleBack();
  }

  protected async handleRemove(): Promise<void> {
    const annotation: RamenAnnotation | undefined = this.selected();
    if (!annotation || !this.workspace.view.editable()) return;
    await this.dialogs.run((): Promise<void> => this.workspace.actions.removeAnnotation(annotation.id), {
      closeOnSuccess: false,
    });
    if (!this.dialogs.error()) this.handleBack();
  }
}
