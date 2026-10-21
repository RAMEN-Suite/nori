import {
  DestroyRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { ModelRef } from '@ramen-suite/core/model';
import type { AnnotationShape, AnnotationShapeRelation, RelationOption } from '@ramen-suite/core/ramen';
import { Checkbox, InputNumber, Select } from '@sushi-kit/angular';
import { ProjectService } from '../../../../../services/projects/project.service';
import { WorkspaceService, type WorkspaceContext } from '../../../../../services/workspace/workspace.service';

@Component({
  selector: 'nori-shape-relation-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoDirective, Checkbox, InputNumber, Select],
  templateUrl: './shape-relation-form.component.html',
  styleUrl: './shape-relation-form.component.scss',
})
export class ShapeRelationFormComponent {
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  public readonly shape: InputSignal<AnnotationShape> = input.required();
  public readonly ownerModelId: InputSignal<string> = input.required();
  public readonly index: InputSignal<number> = input(-1);
  public readonly editable: InputSignal<boolean> = input(true);
  public readonly saved: OutputEmitterRef<number> = output();
  public readonly submitRequested: OutputEmitterRef<void> = output();
  public readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly direction: WritableSignal<'incoming' | 'outgoing'> = signal('outgoing');
  protected readonly refs: WritableSignal<readonly string[]> = signal([]);
  protected minimum: number = 0;
  protected maximum: number | null = null;
  private initialValue: string = '';

  protected readonly options: Signal<readonly RelationOption[]> = computed(() => {
    this.workspace.store.currentModel();
    const nodeId: string | null = this.workspace.store.currentNodeId();
    return nodeId
      ? (this.workspace.store
          .getDraft()
          .suggestAnnotationShapeOptions(nodeId)
          ?.relations.filter((option: RelationOption): boolean => option.direction === this.direction()) ?? [])
      : [];
  });

  public constructor() {
    effect((): void => {
      this.shape();
      this.index();
      untracked((): void => this.reset());
    });
  }

  public reset(): void {
    const rule: AnnotationShapeRelation | undefined = this.shape().relations[this.index()];
    this.direction.set(rule?.direction ?? 'outgoing');
    const modelId: string = this.ownerModelId();
    this.refs.set(
      rule?.relationIds.map((ref: string): string => (ModelRef.isQualified(ref) ? ref : ModelRef.qualify(modelId, ref))) ?? [],
    );
    this.minimum = rule?.bounds.lowerBound ?? 0;
    const maximum: number = rule?.bounds.upperBound ?? -1;
    this.maximum = maximum === -1 ? null : maximum;
    this.initialValue = JSON.stringify(this.values());
  }

  public hasChanges(): boolean {
    return this.initialValue !== JSON.stringify(this.values());
  }

  protected changeDirection(value: unknown): void {
    if (value !== 'outgoing' && value !== 'incoming') return;
    this.direction.set(value);
    this.refs.set([]);
  }

  protected reference(option: RelationOption): string {
    return ModelRef.isQualified(option.ref) ? option.ref : ModelRef.qualify(option.modelId, option.ref);
  }

  protected toggle(option: RelationOption): void {
    const ref: string = this.reference(option);
    this.refs.update((refs: readonly string[]): readonly string[] =>
      refs.includes(ref) ? refs.filter((item: string): boolean => item !== ref) : [...refs, ref],
    );
  }

  public async commit(): Promise<void> {
    if (!this.editable() || this.saving() || !this.hasChanges()) return;
    this.saving.set(true);
    try {
      const shape: AnnotationShape = this.shape();
      const relations: AnnotationShapeRelation[] = [...shape.relations];
      const index: number = this.index() < 0 ? relations.length : this.index();
      relations[index] = this.values();
      const context: WorkspaceContext | null = this.workspace.context();
      await this.workspace.actions.updateAnnotationShape(shape.id, { relations });
      if (this.destroyRef.destroyed || !context || !this.workspace.isCurrent(context) || this.shape().id !== shape.id) return;
      this.initialValue = JSON.stringify(this.values());
      this.saved.emit(index);
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.projects.reportError(error);
    } finally {
      this.saving.set(false);
    }
  }

  private values(): AnnotationShapeRelation {
    return {
      relationIds: this.refs(),
      direction: this.direction(),
      bounds: { lowerBound: this.minimum, upperBound: this.maximum ?? -1 },
    };
  }
}
