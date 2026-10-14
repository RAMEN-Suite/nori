import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePencil } from '@lucide/angular';
import { Button, Input } from '@sushi-kit/angular';
import { toPascalName } from '../../../../../../utils/model-names';
import { AutoselectDirective } from '../../../../../../directives/autoselect.directive';
import { TooltipDirective } from '../../../../../../directives/tooltip.directive';
import { ProjectService } from '../../../../../../services/projects/project.service';
import { WorkspaceService } from '../../../../../../services/workspace/workspace.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-node-basics',
  imports: [TranslocoDirective, Button, Input, TooltipDirective, FormsModule, AutoselectDirective, LucidePencil],
  templateUrl: './node-basics.component.html',
})
export class NodeBasicsComponent {
  private readonly projects: ProjectService = inject(ProjectService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly injector: Injector = inject(Injector);

  private readonly renameButton: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild('renameButton');

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

  protected handleStartRename(): void {
    if (!this.workspace.queries.nodeEditable() || this.savingName()) return;

    this.draftName.set(this.workspace.queries.currentNode()?.name ?? '');
    this.editingName.set(true);
  }

  protected handleCancelRename(restoreFocus: boolean = true): void {
    this.editingName.set(false);
    if (restoreFocus) afterNextRender((): void => this.renameButton()?.nativeElement.focus(), { injector: this.injector });
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
      if (this.workspace.store.currentNodeId() === selectedId) this.handleCancelRename(restoreFocus);
    } catch (error: unknown) {
      this.projects.reportError(error);
    } finally {
      this.savingName.set(false);
    }
  }
}
