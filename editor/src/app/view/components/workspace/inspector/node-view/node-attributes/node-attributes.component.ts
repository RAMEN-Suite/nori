import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, type Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePencil, LucideTags } from '@lucide/angular';
import type { Attribute, Node } from '@ramen-suite/core/model';
import { RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import { Button, Divider, List, ListItemTemplate, type ListTrackBy } from '@sushi-kit/angular';
import { ScrollOverflowDirective } from '../../../../../../directives/scroll-overflow.directive';
import { DialogService, type DialogRef } from '../../../../../../services/interaction/dialog.service';
import { ProjectService } from '../../../../../../services/projects/project.service';
import { PropertyEditingService } from '../../../../../../services/workspace/editing/property-editing.service';
import { WorkspaceService } from '../../../../../../services/workspace/workspace.service';
import type { NodeDefinition } from '../../../../../../models/WorkspaceDetails';
import { groupBy } from '../../../../../../utils/collections';
import { EditAnnotationsDialog } from '../../../../dialogs/edit-annotations/edit-annotations.dialog';
import { ScrollHintsComponent } from '../../../../shared/scroll-hints/scroll-hints.component';
import { NodeAttributeComponent } from './node-attribute/node-attribute.component';

interface InspectorProperty {
  readonly attribute: Attribute;
  readonly levelIndex: number;
  readonly nodeId: string;
}

interface InspectorPropertyGroup {
  readonly levelIndex: number;
  readonly modelName: string | null;
  readonly properties: readonly InspectorProperty[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-node-attributes',
  imports: [
    ScrollOverflowDirective,
    ScrollHintsComponent,
    TranslocoDirective,
    Divider,
    List,
    ListItemTemplate,
    NodeAttributeComponent,
    Button,
    LucidePencil,
    LucideTags,
  ],
  templateUrl: './node-attributes.component.html',
  styleUrl: './node-attributes.component.scss',
})
export class NodeAttributesComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly projects: ProjectService = inject(ProjectService);
  protected readonly propertyEditing: PropertyEditingService = inject(PropertyEditingService);

  private dialogRef: DialogRef | null = null;

  protected readonly trackProperty: ListTrackBy<InspectorProperty> = (_index: number, property: InspectorProperty): string =>
    `${property.nodeId}:${property.attribute.id}`;

  protected readonly isAnnotation: Signal<boolean> = computed(
    (): boolean =>
      this.workspace.queries.currentNode()?.id === RAMEN_ELEMENT.ANNOTATION ||
      this.workspace.queries
        .currentNodeChain()
        .some((base: NodeDefinition): boolean => base.node.id === RAMEN_ELEMENT.ANNOTATION),
  );
  protected readonly propertyGroups: Signal<readonly InspectorPropertyGroup[]> = computed(
    (): readonly InspectorPropertyGroup[] => {
      const node: Node | null = this.workspace.queries.currentNode();
      if (!node) return [];

      const levelIndex: number = this.workspace.queries.nodeOwner()?.levelIndex ?? 0;
      const inherited: readonly InspectorProperty[] = [...this.workspace.queries.inheritedAttributes().values()].flat();
      const own: InspectorProperty[] = node.attributes.map(
        (attribute: Attribute): InspectorProperty => ({
          attribute,
          levelIndex,
          nodeId: node.id,
        }),
      );
      const groups: ReadonlyMap<number, readonly InspectorProperty[]> = groupBy(
        [...inherited, ...own],
        (property: InspectorProperty): number => property.levelIndex,
      );

      return [...groups]
        .sort(([left], [right]): number => left - right)
        .map(
          ([levelIndex, properties]): InspectorPropertyGroup => ({
            levelIndex,
            modelName: this.projects.recordsByLevelIndex().get(levelIndex)?.name ?? null,
            properties,
          }),
        );
    },
  );

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected handleEditAnnotations(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogs.open(EditAnnotationsDialog, { headerKey: 'editor.editAnnotations' });
  }
}
