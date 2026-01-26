import { GModel, Id } from '../../core/models/GModel';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { NodeColors } from '../../models/ModelRecord';

@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  public readonly currentModel: WritableSignal<GModel | null> = signal<GModel | null>(null);
  public readonly currentNodeId: WritableSignal<Id | null> = signal<Id | null>(null);
  public readonly currentSlot: WritableSignal<number> = signal<number>(1);

  public readonly currentNodeColors: WritableSignal<NodeColors> = signal<NodeColors>({});

  public setCurrentNodeColors(map: NodeColors): void {
    this.currentNodeColors.set(map);
  }

  public updateCurrentNodeColors(nodeId: Id, hexColor: string): void {
    this.currentNodeColors.update((c: NodeColors): NodeColors => ({ ...c, [nodeId]: hexColor }));
  }

  public setCurrentNodeId(nodeId: Id | null): void {
    this.currentNodeId.set(nodeId);
  }

  public setCurrentSlot(slot: number | null): void {
    if (slot === null || isNaN(slot)) return this.currentSlot.set(1);
    this.currentSlot.set(Math.max(1, slot));
  }

  public setCurrentModel(model: GModel | null): void {
    this.currentModel.set(model);
  }
}
