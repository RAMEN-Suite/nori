import { ChangeDetectionStrategy, Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideArrowRight } from '@lucide/angular';
import { Badge } from '@sushi-kit/angular';
import { type AffectedLevel, type AffectedNode, type AffectedRelation } from '../../../../core/utils/RemovalSummary';

export type { AffectedNode } from '../../../../core/utils/RemovalSummary';

interface NodeGroup {
  readonly modelSlot: number | null;
  readonly modelName: string;
  readonly names: string[];
}

interface RelationGroup {
  readonly modelSlot: number | null;
  readonly name: string;
  readonly modelName: string;
  readonly relations: AffectedRelation[];
}

@Component({
  selector: 'app-confirmation-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Badge, LucideArrowRight],
  templateUrl: './confirmation-content.component.html',
  styleUrl: './confirmation-content.component.scss',
})
export class ConfirmationContentComponent {
  public readonly message: InputSignal<string> = input.required<string>();
  public readonly details: InputSignal<readonly string[]> = input<readonly string[]>([]);
  public readonly affectedNodes: InputSignal<readonly AffectedNode[]> = input<readonly AffectedNode[]>([]);
  public readonly affectedRelations: InputSignal<readonly AffectedRelation[]> = input<readonly AffectedRelation[]>([]);
  public readonly affectedLevels: InputSignal<readonly AffectedLevel[]> = input<readonly AffectedLevel[]>([]);

  protected readonly nodeGroups: Signal<readonly NodeGroup[]> = computed((): readonly NodeGroup[] => {
    const groups: Map<string, NodeGroup> = new Map();
    for (const node of this.affectedNodes()) {
      const key: string = JSON.stringify([node.modelSlot, node.modelName]);
      const group: NodeGroup = groups.get(key) ?? { modelName: node.modelName, modelSlot: node.modelSlot, names: [] };
      group.names.push(node.name);
      groups.set(key, group);
    }
    return [...groups.values()];
  });

  protected readonly relationGroups: Signal<readonly RelationGroup[]> = computed((): readonly RelationGroup[] => {
    const groups: Map<string, RelationGroup> = new Map();
    for (const relation of this.affectedRelations()) {
      const key: string = JSON.stringify([relation.modelSlot, relation.modelName, relation.name]);
      const group: RelationGroup = groups.get(key) ?? {
        name: relation.name,
        modelName: relation.modelName,
        modelSlot: relation.modelSlot,
        relations: [],
      };
      group.relations.push(relation);
      groups.set(key, group);
    }
    return [...groups.values()];
  });
}
