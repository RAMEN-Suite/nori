import { GModel, Id } from '../../core/models/GModel';
import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WorkspaceStoreService {
  public readonly workingModel: WritableSignal<GModel | null> = signal<GModel | null>(null);
  public readonly selectedNodeId: WritableSignal<Id | null> = signal<Id | null>(null);
  public readonly selectedSlot: WritableSignal<number> = signal<number>(1);

  public setSelectedNodeId(selectedNodeId: Id | null): void {
    this.selectedNodeId.set(selectedNodeId);
  }

  public setSelectedSlot(selectedSlot: number): void {
    this.setSelectedNodeId(null);
    this.selectedSlot.set(Math.max(1, selectedSlot));
  }

  public setWorkingModel(workingModel: GModel | null): void {
    this.workingModel.set(workingModel);
  }

  public resetSelections(): void {
    this.selectedNodeId.set(null);
    this.selectedSlot.set(1);
  }
}
