import {
  DestroyRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  linkedSignal,
  inject,
  input,
  output,
  signal,
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
  public readonly isSaving: WritableSignal<boolean> = signal(false);
  private readonly initialRelation: Signal<AnnotationShapeRelation> = computed((): AnnotationShapeRelation => {
    const rule: AnnotationShapeRelation | undefined = this.shape().relations[this.index()];
    const modelId: string = this.ownerModelId();
    return {
      relationIds:
        rule?.relationIds.map((ref: string): string => (ModelRef.isQualified(ref) ? ref : ModelRef.qualify(modelId, ref))) ?? [],
      direction: rule?.direction ?? 'outgoing',
      bounds: { lowerBound: rule?.bounds.lowerBound ?? 0, upperBound: rule?.bounds.upperBound ?? -1 },
    };
  });
  protected readonly direction: WritableSignal<'incoming' | 'outgoing'> = linkedSignal({
    source: this.initialRelation,
    computation: (relation): 'incoming' | 'outgoing' => relation.direction,
  });
  protected readonly refs: WritableSignal<readonly string[]> = linkedSignal({
    source: this.initialRelation,
    computation: (relation): readonly string[] => relation.relationIds,
  });
  protected readonly minimum: WritableSignal<number> = linkedSignal({
    source: this.initialRelation,
    computation: (relation): number => relation.bounds.lowerBound,
  });
  protected readonly maximum: WritableSignal<number | null> = linkedSignal({
    source: this.initialRelation,
    computation: (relation): number | null => this.upperLimit(relation),
  });
  private readonly initialValue: WritableSignal<string> = linkedSignal((): string => JSON.stringify(this.initialRelation()));

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

  public reset(): void {
    const relation: AnnotationShapeRelation = this.initialRelation();
    this.direction.set(relation.direction);
    this.refs.set(relation.relationIds);
    this.minimum.set(relation.bounds.lowerBound);
    this.maximum.set(this.upperLimit(relation));
    this.initialValue.set(JSON.stringify(relation));
  }

  private upperLimit(relation: AnnotationShapeRelation): number | null {
    return relation.bounds.upperBound === -1 ? null : relation.bounds.upperBound;
  }

  public hasChanges(): boolean {
    return this.initialValue() !== JSON.stringify(this.values());
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
    if (!this.editable() || this.isSaving() || !this.hasChanges()) return;
    this.isSaving.set(true);
    try {
      const shape: AnnotationShape = this.shape();
      const relations: AnnotationShapeRelation[] = [...shape.relations];
      const index: number = this.index() < 0 ? relations.length : this.index();
      const submitted: AnnotationShapeRelation = this.values();
      relations[index] = submitted;
      const context: WorkspaceContext | null = this.workspace.context();
      await this.workspace.actions.updateAnnotationShape(shape.id, { relations });
      if (this.destroyRef.destroyed || !context || !this.workspace.isCurrent(context) || this.shape().id !== shape.id) return;
      this.initialValue.set(JSON.stringify(submitted));
      this.saved.emit(index);
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.projects.reportError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  private values(): AnnotationShapeRelation {
    return {
      relationIds: this.refs(),
      direction: this.direction(),
      bounds: { lowerBound: this.minimum(), upperBound: this.maximum() ?? -1 },
    };
  }
}
