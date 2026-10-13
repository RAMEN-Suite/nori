import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, type Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucidePencil, LucideTags } from '@lucide/angular';
import type { Attribute, Node } from '@ramen-suite/core/model';
import { RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import { Button, Divider, List, ListItemTemplate } from '@sushi-kit/angular';
import { ScrollOverflowDirective } from '../../../../directives/scroll-overflow.directive';
import { DialogService, type DialogRef } from '../../../../services/dialog.service';
import { StorageService } from '../../../../services/storage.service';
import { PropertyEditingService } from '../../../../services/workspace/property-editing.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import type { NodeLevel } from '../../../../services/workspace/workspace.view';
import { EditAnnotationsDialog } from '../../dialogs/edit-annotations/edit-annotations.dialog';
import { ScrollHintsComponent } from '../../scroll-hints/scroll-hints.component';
import { NodeAttributeComponent } from './node-attribute/node-attribute.component';

interface InspectorProperty {
  readonly attribute: Attribute;
  readonly slot: number;
  readonly nodeId: string;
}

interface InspectorPropertyGroup {
  readonly slot: number;
  readonly modelName: string | null;
  readonly properties: readonly InspectorProperty[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-attributes',
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
  private readonly storage: StorageService = inject(StorageService);
  protected readonly propertyEditing: PropertyEditingService = inject(PropertyEditingService);

  private dialogRef: DialogRef | null = null;

  protected readonly isAnnotation: Signal<boolean> = computed(
    (): boolean =>
      this.workspace.view.currentNode()?.id === RAMEN_ELEMENT.ANNOTATION ||
      this.workspace.view.currentNodeChain().some((base: NodeLevel): boolean => base.node.id === RAMEN_ELEMENT.ANNOTATION),
  );

  protected readonly propertyGroups: Signal<readonly InspectorPropertyGroup[]> = computed(
    (): readonly InspectorPropertyGroup[] => {
      const node: Node | null = this.workspace.view.currentNode();
      if (!node) return [];

      const slot: number = this.workspace.view.nodeOwner()?.slot ?? 0;
      const inherited: readonly InspectorProperty[] = [...this.workspace.view.inheritedAttributes().values()].flat();
      const own: InspectorProperty[] = node.attributes.map(
        (attribute: Attribute): InspectorProperty => ({
          attribute,
          slot,
          nodeId: node.id,
        }),
      );
      const groups: Map<number, InspectorProperty[]> = new Map();
      for (const property of [...inherited, ...own]) {
        const items: InspectorProperty[] = groups.get(property.slot) ?? [];
        items.push(property);
        groups.set(property.slot, items);
      }
      return [...groups]
        .sort(([left], [right]): number => left - right)
        .map(
          ([slot, properties]): InspectorPropertyGroup => ({
            slot,
            modelName: this.storage.recordsBySlot().get(slot)?.name ?? null,
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
