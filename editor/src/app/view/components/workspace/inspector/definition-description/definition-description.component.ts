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
  public readonly isBusy: Signal<boolean> = computed(() => this.isEditing() || this.isSaving());
  private readonly paragraph: Signal<ElementRef<HTMLElement> | undefined> = viewChild('descriptionText', { read: ElementRef });
  protected readonly isExpanded: WritableSignal<boolean> = signal(false);
  protected readonly isOverflowing: WritableSignal<boolean> = signal(false);
  protected readonly fieldId: string = `definition-description-${crypto.randomUUID()}`;
  protected readonly draft: WritableSignal<string> = signal('');
  protected readonly isEditing: WritableSignal<boolean> = signal(false);
  protected readonly isSaving: WritableSignal<boolean> = signal(false);
  protected readonly isValid: Signal<boolean> = computed(() => isDescriptionValid(this.draft()));
  protected readonly hasChanges: Signal<boolean> = computed(() => descriptionValue(this.draft()) !== (this.value() ?? ''));
  private readonly contextKey: WritableSignal<string> = signal('');

  public constructor() {
    effect((): void => {
      const key: string = `${this.kind()}:${this.elementId()}`;
      const value: string = this.value() ?? '';
      untracked((): void => {
        if (this.isSaving() && this.contextKey() === key) return;
        this.contextKey.set(key);
        this.draft.set(value);
        this.isEditing.set(false);
        this.isExpanded.set(false);
      });
    });
    effect((onCleanup): void => {
      const paragraph: HTMLElement | undefined = this.paragraph()?.nativeElement;
      const value: string | undefined = this.value();
      if (!paragraph || !value) return;
      const observer: ResizeObserver = new ResizeObserver((): void => {
        this.isOverflowing.set(paragraph.scrollHeight > paragraph.clientHeight + 1);
      });
      observer.observe(paragraph);
      onCleanup((): void => observer.disconnect());
    });
  }

  public start(): void {
    if (!this.editable() || this.isSaving()) return;
    this.draft.set(this.value() ?? '');
    this.isEditing.set(true);
    afterNextRender((): void => this.content()?.nativeElement.querySelector('textarea')?.focus(), { injector: this.injector });
  }

  protected cancel(): void {
    if (this.isSaving()) return;
    this.draft.set(this.value() ?? '');
    this.isEditing.set(false);
    this.focusAction();
  }

  protected async save(): Promise<void> {
    if (!this.editable() || this.isSaving() || !this.isValid() || !this.hasChanges()) return;
    const key: string = this.contextKey();
    const elementId: string = this.elementId();
    const description: string = descriptionValue(this.draft());
    this.isSaving.set(true);
    try {
      if (this.kind() === 'node') await this.workspace.actions.updateNode(elementId, { description });
      else await this.workspace.actions.updateRelation(elementId, { description });
      if (this.destroyRef.destroyed || this.contextKey() !== key) return;
      this.isEditing.set(false);
      this.focusAction();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed && this.contextKey() === key) this.projects.reportError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  private focusAction(): void {
    if (this.destroyRef.destroyed) return;
    afterNextRender((): void => this.editButton()?.nativeElement.focus(), { injector: this.injector });
    this.finished.emit();
  }
}
