import { ChangeDetectionStrategy, Component, computed, inject, type Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowUpRight } from '@lucide/angular';
import { type Bounds, type Constraint, type Relation } from '@ramen-suite/core/model';
import { Badge, Button, Divider } from '@sushi-kit/angular';
import { ScrollOverflowDirective } from '../../../../../directives/scroll-overflow.directive';
import { NavigationService } from '../../../../../services/interaction/navigation.service';
import { ProjectService } from '../../../../../services/projects/project.service';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { ScrollHintsComponent } from '../../../shared/scroll-hints/scroll-hints.component';

interface RelationEndpoint {
  readonly key: 'from' | 'to';
  readonly labelKey: string;
  readonly reference: string;
  readonly name: string;
  readonly cardinality: string;
  readonly constraints: readonly Constraint[];
}

@Component({
  selector: 'nori-relation-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Badge, Button, Divider, LucideArrowUpRight, ScrollOverflowDirective, ScrollHintsComponent],
  templateUrl: './relation-view.component.html',
  styles: ':host { display: block; height: 100%; } :host:hover, :host:focus-within { --nori-scroll-hint-play-state: running; }',
})
export class RelationViewComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly projects: ProjectService = inject(ProjectService);

  protected readonly endpoints: Signal<readonly RelationEndpoint[]> = computed((): readonly RelationEndpoint[] => {
    const relation: Relation | null = this.workspace.queries.currentRelation();
    return relation
      ? (['from', 'to'] as const).map(
          (key): RelationEndpoint => ({
            key,
            labelKey: key === 'from' ? 'editor.relationSourceLabel' : 'editor.relationTargetLabel',
            reference: relation[key].nodeId,
            name: this.workspace.queries.resolveNodeLabel(relation[key].nodeId),
            cardinality: this.cardinality(relation[key].bounds),
            constraints: relation[key].constraints ?? [],
          }),
        )
      : [];
  });

  protected async inspectNode(reference: string): Promise<void> {
    try {
      await this.navigation.navigateToNode(this.workspace.store.currentLevelIndex(), reference);
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  private cardinality(bounds: Bounds): string {
    return `${bounds.lowerBound}…${bounds.upperBound === -1 ? '*' : bounds.upperBound}`;
  }
}
