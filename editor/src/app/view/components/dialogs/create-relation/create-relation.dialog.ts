import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { Fieldset } from 'primeng/fieldset';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Direction, SelectableRelation } from '@ramen-suite/core/gcore';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { GNode } from '@ramen-suite/core/gcore';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { IftaLabel } from 'primeng/iftalabel';
import { Select } from 'primeng/select';
import { Button } from 'primeng/button';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { CreateRelationInput } from '@ramen-suite/core/gcore';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'app-create-relation',
  imports: [Fieldset, ReactiveFormsModule, FormsModule, AutoComplete, IftaLabel, Select, Button, Tooltip],
  templateUrl: './create-relation.dialog.html',
  styleUrl: './create-relation.dialog.scss',
})
export class CreateRelationDialog {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly dialogRef: DynamicDialogRef = inject(DynamicDialogRef);

  protected isSubmitted: boolean = false;

  protected readonly selectedDirection: WritableSignal<Direction> = signal('OUT');
  protected readonly selectedTargetNode: WritableSignal<GNode | null> = signal(null);
  protected readonly selectedRelation: WritableSignal<SelectableRelation | null> = signal(null);

  protected readonly filteredReachableNodes: WritableSignal<GNode[]> = signal([]);
  protected readonly allowedRelations: Signal<SelectableRelation[]> = computed((): SelectableRelation[] => {
    const currentTargetNode: GNode | null = this.selectedTargetNode();
    const direction: Direction = this.selectedDirection();
    if (!currentTargetNode) return [];
    return Array.from(this.workspace.view.resolveAllowedRelations(currentTargetNode.id, direction));
  });

  protected handleAutoComplete($event: AutoCompleteCompleteEvent): void {
    const reachableNodes: ReadonlyArray<GNode> = this.workspace.view.resolveReachableNodes(this.selectedDirection());
    const filtered: GNode[] = reachableNodes.filter((node: GNode): boolean => {
      const query: string = $event.query.toLowerCase().trim();
      return node.name.toLowerCase().trim().includes(query);
    });
    this.filteredReachableNodes.set(filtered);
  }

  protected handleCloseModal(): void {
    this.dialogRef.close();
  }

  protected isFormValid(): boolean {
    return this.selectedRelation() !== null;
  }

  protected handleChangeDirection(): void {
    const isOutbound: boolean = this.selectedDirection() === 'OUT';
    this.selectedDirection.set(isOutbound ? 'IN' : 'OUT');
    this.selectedRelation.set(null);
  }

  protected handleSelectTargetNode($event: string | GNode): void {
    if (typeof $event === 'string') return;
    this.selectedRelation.set(null);
    this.selectedTargetNode.set($event);
  }

  protected handleSelectRelation($event: SelectableRelation): void {
    this.selectedRelation.set($event);
  }

  protected async handleCreateRelation(): Promise<void> {
    this.isSubmitted = true;
    if (!this.isFormValid()) return;

    const relation: SelectableRelation | null = this.selectedRelation();
    const currentNodeId: string | null = this.workspace.store.currentNodeId();
    const currentTargetId: string | undefined = this.selectedTargetNode()?.id;
    if (!relation || !currentNodeId || !currentTargetId) return;

    const fromNodeId: string = relation.direction === 'OUT' ? currentNodeId : currentTargetId;
    const toNodeId: string = relation.direction === 'OUT' ? currentTargetId : currentNodeId;

    const input: CreateRelationInput = { baseRelationId: relation.baseRelationId, fromNodeId, toNodeId };
    void this.workspace.actions.createRelation(input);
    this.dialogRef.close();
  }
}
