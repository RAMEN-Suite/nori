import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  type ElementRef,
  inject,
  input,
  Injector,
  signal,
  viewChild,
  type InputSignal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { Input } from '@sushi-kit/angular';
import { AutoselectDirective } from '../../../../../../directives/autoselect.directive';
import { ProjectService } from '../../../../../../services/projects/project.service';
import { WorkspaceService } from '../../../../../../services/workspace/workspace.service';
import { toPascalName } from '../../../../../../utils/model-names';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-node-basics',
  imports: [TranslocoDirective, Input, FormsModule, AutoselectDirective],
  templateUrl: './node-basics.component.html',
})
export class NodeBasicsComponent {
  private readonly projects: ProjectService = inject(ProjectService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly injector: Injector = inject(Injector);

  public readonly showEditingControls: InputSignal<boolean> = input(false);
  private readonly title: Signal<ElementRef<HTMLElement> | undefined> = viewChild('renameTarget');

  protected readonly draftName: WritableSignal<string> = signal('');
  protected readonly savingName: WritableSignal<boolean> = signal(false);
  protected readonly editingName: WritableSignal<boolean> = signal(false);

  public constructor() {
    effect((): void => {
      const currentName: string | undefined = this.workspace.queries.currentNode()?.name;
      this.draftName.set(currentName ?? '');
      this.editingName.set(false);
    });
  }

  protected handleBlurName(): void {
    if (!this.savingName()) this.handleCancelRename(false);
  }

  protected handleStartRename(): void {
    if (!this.workspace.queries.nodeEditable() || this.savingName()) return;

    this.draftName.set(this.workspace.queries.currentNode()?.name ?? '');
    this.editingName.set(true);
  }

  protected handleCancelRename(restoreFocus: boolean = true): void {
    if (this.savingName()) return;
    this.editingName.set(false);
    if (restoreFocus) this.focusTitle();
  }

  protected focusTitle(): void {
    afterNextRender((): void => this.title()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async handleSaveName(restoreFocus: boolean = false): Promise<void> {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    const name: string = this.draftName().trim();
    if (!this.editingName() || !selectedId || this.savingName() || !this.workspace.queries.nodeEditable()) return;
    if (!name) {
      this.handleCancelRename(restoreFocus);
      return;
    }

    const transformedName: string = toPascalName(name);

    this.savingName.set(true);
    try {
      await this.workspace.actions.updateNode(selectedId, { name: transformedName });
      if (this.workspace.store.currentNodeId() === selectedId) {
        this.editingName.set(false);
        if (restoreFocus) this.focusTitle();
      }
    } catch (error: unknown) {
      this.projects.reportError(error);
    } finally {
      this.savingName.set(false);
    }
  }
}
