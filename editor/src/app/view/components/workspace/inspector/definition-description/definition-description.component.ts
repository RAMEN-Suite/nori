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
  output,
  signal,
  untracked,
  viewChild,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePencil, LucideSave, LucideUndo2 } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { ProjectService } from '../../../../../services/projects/project.service';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { descriptionValue, isDescriptionValid } from '../../../../../utils/descriptions';
import { DescriptionFieldComponent } from '../../../shared/description-field/description-field.component';

@Component({
  selector: 'nori-definition-description',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, DescriptionFieldComponent, LucidePencil, LucideSave, LucideUndo2],
  host: { class: 'block min-w-0' },
  templateUrl: './definition-description.component.html',
})
export class DefinitionDescriptionComponent {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly injector: Injector = inject(Injector);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly editButton: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild('editDescriptionButton');
  private readonly content: Signal<ElementRef<HTMLElement> | undefined> = viewChild('descriptionContent', { read: ElementRef });
  public readonly elementId: InputSignal<string> = input.required();
  public readonly kind: InputSignal<'node' | 'relation'> = input.required();
  public readonly value: InputSignal<string | undefined> = input<string>();
  public readonly editable: InputSignal<boolean> = input(false);
  public readonly showEditAction: InputSignal<boolean> = input(false);
  public readonly finished: OutputEmitterRef<void> = output();
  public readonly busy: Signal<boolean> = computed(() => this.editing() || this.saving());
  private readonly paragraph: Signal<ElementRef<HTMLElement> | undefined> = viewChild('descriptionText', { read: ElementRef });
  protected readonly expanded: WritableSignal<boolean> = signal(false);
  protected readonly overflowing: WritableSignal<boolean> = signal(false);
  protected readonly fieldId: string = `definition-description-${crypto.randomUUID()}`;
  protected readonly draft: WritableSignal<string> = signal('');
  protected readonly editing: WritableSignal<boolean> = signal(false);
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly valid: Signal<boolean> = computed(() => isDescriptionValid(this.draft()));
  protected readonly changed: Signal<boolean> = computed(() => descriptionValue(this.draft()) !== (this.value() ?? ''));
  private readonly contextKey: WritableSignal<string> = signal('');

  public constructor() {
    effect((): void => {
      const key: string = `${this.kind()}:${this.elementId()}`;
      const value: string = this.value() ?? '';
      untracked((): void => {
        if (this.saving() && this.contextKey() === key) return;
        this.contextKey.set(key);
        this.draft.set(value);
        this.editing.set(false);
        this.expanded.set(false);
      });
    });
    effect((onCleanup): void => {
      const paragraph: HTMLElement | undefined = this.paragraph()?.nativeElement;
      const value: string | undefined = this.value();
      if (!paragraph || !value) return;
      const observer: ResizeObserver = new ResizeObserver((): void => {
        this.overflowing.set(paragraph.scrollHeight > paragraph.clientHeight + 1);
      });
      observer.observe(paragraph);
      onCleanup((): void => observer.disconnect());
    });
  }

  public start(): void {
    if (!this.editable() || this.saving()) return;
    this.draft.set(this.value() ?? '');
    this.editing.set(true);
    afterNextRender((): void => this.content()?.nativeElement.querySelector('textarea')?.focus(), { injector: this.injector });
  }

  protected cancel(): void {
    if (this.saving()) return;
    this.draft.set(this.value() ?? '');
    this.editing.set(false);
    this.focusAction();
  }

  protected async save(): Promise<void> {
    if (!this.editable() || this.saving() || !this.valid() || !this.changed()) return;
    const key: string = this.contextKey();
    const elementId: string = this.elementId();
    const description: string = descriptionValue(this.draft());
    this.saving.set(true);
    try {
      if (this.kind() === 'node') await this.workspace.actions.updateNode(elementId, { description });
      else await this.workspace.actions.updateRelation(elementId, { description });
      if (this.destroyRef.destroyed || this.contextKey() !== key) return;
      this.editing.set(false);
      this.focusAction();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed && this.contextKey() === key) this.projects.reportError(error);
    } finally {
      this.saving.set(false);
    }
  }

  private focusAction(): void {
    if (this.destroyRef.destroyed) return;
    afterNextRender((): void => this.editButton()?.nativeElement.focus(), { injector: this.injector });
    this.finished.emit();
  }
}
