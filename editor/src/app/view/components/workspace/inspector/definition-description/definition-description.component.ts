import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  type InputSignal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePencil, LucidePlus, LucideSave, LucideUndo2 } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { ProjectService } from '../../../../../services/projects/project.service';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { descriptionValue, isDescriptionValid } from '../../../../../utils/descriptions';
import { DescriptionFieldComponent } from '../../../shared/description-field/description-field.component';

@Component({
  selector: 'nori-definition-description',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, DescriptionFieldComponent, LucidePencil, LucidePlus, LucideSave, LucideUndo2],
  templateUrl: './definition-description.component.html',
})
export class DefinitionDescriptionComponent {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector: Injector = inject(Injector);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  public readonly elementId: InputSignal<string> = input.required();
  public readonly kind: InputSignal<'node' | 'relation'> = input.required();
  public readonly value: InputSignal<string | undefined> = input<string>();
  public readonly editable: InputSignal<boolean> = input(false);
  protected readonly fieldId: string = `definition-description-${crypto.randomUUID()}`;
  protected readonly draft: WritableSignal<string> = signal('');
  protected readonly editing: WritableSignal<boolean> = signal(false);
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly valid: Signal<boolean> = computed(() => isDescriptionValid(this.draft()));
  protected readonly changed: Signal<boolean> = computed(() => descriptionValue(this.draft()) !== (this.value() ?? ''));
  private contextKey: string = '';

  public constructor() {
    effect((): void => {
      const key: string = `${this.kind()}:${this.elementId()}`;
      const value: string = this.value() ?? '';
      untracked((): void => {
        if (this.saving() && this.contextKey === key) return;
        this.contextKey = key;
        this.draft.set(value);
        this.editing.set(false);
      });
    });
  }

  protected start(): void {
    if (!this.editable() || this.saving()) return;
    this.draft.set(this.value() ?? '');
    this.editing.set(true);
    afterNextRender((): void => this.element.nativeElement.querySelector('textarea')?.focus(), { injector: this.injector });
  }

  protected cancel(): void {
    if (this.saving()) return;
    this.draft.set(this.value() ?? '');
    this.editing.set(false);
    this.focusAction();
  }

  protected async save(): Promise<void> {
    if (!this.editable() || this.saving() || !this.valid() || !this.changed()) return;
    const key: string = this.contextKey;
    const elementId: string = this.elementId();
    const description: string = descriptionValue(this.draft());
    this.saving.set(true);
    try {
      if (this.kind() === 'node') await this.workspace.actions.updateNode(elementId, { description });
      else await this.workspace.actions.updateRelation(elementId, { description });
      if (this.destroyRef.destroyed || this.contextKey !== key) return;
      this.editing.set(false);
      this.focusAction();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed && this.contextKey === key) this.projects.reportError(error);
    } finally {
      this.saving.set(false);
    }
  }

  private focusAction(): void {
    if (this.destroyRef.destroyed) return;
    afterNextRender(
      (): void => this.element.nativeElement.querySelector<HTMLButtonElement>('[data-description-action]')?.focus(),
      { injector: this.injector },
    );
  }
}
