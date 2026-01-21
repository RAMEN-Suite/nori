import { GModel, Id } from '../../core/models/GModel';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { NodeColors } from '../../models/ModelRecord';

@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  public readonly workingModel: WritableSignal<GModel | null> = signal<GModel | null>(null);
  public readonly selectedNodeId: WritableSignal<Id | null> = signal<Id | null>(null);
  public readonly selectedSlot: WritableSignal<number | null> = signal<number | null>(null);

  public readonly selectedNodeColors: WritableSignal<NodeColors> = signal<NodeColors>({});

  public setSelectedNodeColors(nodeColors: NodeColors): void {
    this.selectedNodeColors.set(nodeColors);
  }

  public updateSelectedNodeColor(baseId: Id, hexColor: string): void {
    this.selectedNodeColors.update((c: NodeColors): NodeColors => ({ ...c, [baseId]: hexColor }));
  }

  public setSelectedNodeId(selectedNodeId: Id | null): void {
    this.selectedNodeId.set(selectedNodeId);
  }

  public setSelectedSlot(selectedSlot: number | null): void {
    if (selectedSlot === null) return this.selectedSlot.set(null);
    this.selectedSlot.set(Math.max(1, selectedSlot));
  }

  public setWorkingModel(workingModel: GModel | null): void {
    this.workingModel.set(workingModel);
  }

  public resetSelections(): void {
    this.setSelectedNodeColors({});
    this.setSelectedNodeId(null);
    this.setSelectedSlot(null);
  }
}
