import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  linkedSignal,
  viewChild,
  type InputSignal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { InlineRename } from '../../../../shared/inline-name-input/inline-rename';
import { InlineNameInputComponent } from '../../../../shared/inline-name-input/inline-name-input.component';
import { ProjectService } from '../../../../../../services/projects/project.service';
import { WorkspaceService } from '../../../../../../services/workspace/workspace.service';
import { toPascalName } from '../../../../../../utils/model-names';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-node-basics',
  imports: [TranslocoDirective, InlineNameInputComponent],
  templateUrl: './node-basics.component.html',
})
export class NodeBasicsComponent {
  private readonly projects: ProjectService = inject(ProjectService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  public readonly showEditingControls: InputSignal<boolean> = input(false);
  private readonly title: Signal<ElementRef<HTMLElement> | undefined> = viewChild('renameTarget');

  private readonly renameContext: Signal<string> = computed((): string =>
    JSON.stringify([this.workspace.context(), this.workspace.store.currentNodeId()]),
  );
  protected readonly editingId: WritableSignal<string | null> = linkedSignal({
    source: this.renameContext,
    computation: (): null => null,
  });
  protected readonly rename: InlineRename<string> = new InlineRename(this.editingId, this.renameContext, (error: unknown): void =>
    this.projects.reportError(error),
  );

  protected handleBlurName(): void {
    if (!this.rename.isSaving()) this.handleCancelRename(false);
  }

  protected handleStartRename(): void {
    if (!this.workspace.queries.isNodeEditable() || this.rename.isSaving()) return;

    const id: string | null = this.workspace.store.currentNodeId();
    if (id) this.rename.start(id, this.workspace.queries.currentNode()?.name ?? '');
  }

  protected handleCancelRename(restoreFocus: boolean = true): void {
    if (this.rename.isSaving()) return;
    this.rename.cancel();
    if (restoreFocus) this.focusTitle();
  }

  protected focusTitle(): void {
    this.rename.restoreFocus((): HTMLElement | undefined => this.title()?.nativeElement);
  }

  protected handleSaveName(restoreFocus: boolean = false): Promise<void> {
    if (!this.workspace.queries.isNodeEditable()) return Promise.resolve();
    return this.rename.save(
      (id: string, name: string): Promise<unknown> => this.workspace.actions.updateNode(id, { name: toPascalName(name) }),
      (): void => {
        this.rename.cancel();
        if (restoreFocus) this.focusTitle();
      },
    );
  }
}
