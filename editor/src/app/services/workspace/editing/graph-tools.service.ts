import { effect, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { WorkspaceService, type WorkspaceContext } from '../workspace.service';
import { RelationEditingService } from './relation-editing.service';

export type GraphTool = 'select' | 'connect' | 'erase';

/** Tracks graph modes and connection sources, delegating relationship workflows to the editing service. */
@Injectable({ providedIn: 'root' })
export class GraphToolsService {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly relations: RelationEditingService = inject(RelationEditingService);

  private readonly selectedSource: WritableSignal<string | null> = signal(null);
  private readonly activeTool: WritableSignal<GraphTool> = signal('select');
  private context: WorkspaceContext | null = null;
  public readonly source: Signal<string | null> = this.selectedSource.asReadonly();
  public readonly tool: Signal<GraphTool> = this.activeTool.asReadonly();
  public readonly pending: Signal<boolean> = this.relations.pending;

  public constructor() {
    effect((): void => {
      const context: WorkspaceContext | null = this.workspace.context();
      if (context?.projectId === this.context?.projectId && context?.modelId === this.context?.modelId) return;
      this.context = context;
      this.exit();
    });
  }

  public toggle(tool: GraphTool): void {
    if (this.pending() || !this.workspace.queries.editable()) return;
    this.cancel();
    this.activeTool.update((active: GraphTool): GraphTool => (active === tool ? 'select' : tool));
  }

  public selectSource(id: string): void {
    this.selectedSource.set(id);
  }

  public exit(): void {
    this.activeTool.set('select');
    this.cancel();
  }

  public cancel(): void {
    this.selectedSource.set(null);
  }

  public async connect(from: string, to: string): Promise<void> {
    await this.relations.connect(from, to);
  }

  public remove(id: string): void {
    this.relations.remove(id);
  }
}
