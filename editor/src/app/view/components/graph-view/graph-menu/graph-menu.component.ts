import { LucideMaximize, LucidePalette, LucideEyeOff } from '@lucide/angular';
import { Component, computed, DestroyRef, inject, Signal, signal, WritableSignal, ChangeDetectionStrategy } from '@angular/core';
import { GraphComponent } from '../graph/graph.component';
import { Model } from '@ramen-suite/core/model';
import { ModelGraph, GraphData, GraphLink, GraphNode } from '../../../../core/utils/ModelGraph';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { DEFAULT_GRAPH_LAYOUT_SETTINGS, GraphLayout, GraphLayoutSettings } from '../graph/graph.types';
import { Button, Tooltip } from '@sushi-kit/angular';
import { DialogService, DialogRef } from '../../../../services/dialog.service';
import { NodeColorsDialog } from '../../dialogs/node-colors/node-colors.dialog';

type LayoutToggleOption = 'areIsolatedNodesHidden';

interface LayoutOption {
  label: string;
  mode: GraphLayout;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-visualizer',
  imports: [GraphComponent, Button, Tooltip, LucideMaximize, LucidePalette, LucideEyeOff],
  templateUrl: './graph-menu.component.html',
  styleUrl: './graph-menu.component.scss',
})
export class GraphMenuComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DialogRef | null = null;

  protected layoutOptions: LayoutOption[] = [
    { label: 'Cluster', mode: 'clusterTopDown' },
    { label: 'Tree', mode: 'treeTopDown' },
  ];

  protected readonly settings: WritableSignal<GraphLayoutSettings> = signal({
    ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
    padding: { ...DEFAULT_GRAPH_LAYOUT_SETTINGS.padding },
  });

  protected readonly graphData: Signal<GraphData> = computed((): GraphData => {
    const model: Model | null = this.workspace.store.currentModel();
    const graphData: GraphData = new ModelGraph().build(model, this.workspace.store.getModels());

    const key: string = this.computeGraphKey(graphData);
    if (key === this.previousKey) return this.previousData;

    this.previousKey = key;
    this.previousData = graphData;

    return graphData;
  });

  private previousKey: string = '';
  private previousData: GraphData = { nodes: [], links: [] };

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  public handleSelectLayoutMode(layoutMode: GraphLayout): void {
    this.settings.update((s: GraphLayoutSettings): GraphLayoutSettings => ({ ...s, layout: layoutMode }));
  }

  public handleToggleOption(option: LayoutToggleOption): void {
    this.settings.update((s: GraphLayoutSettings): GraphLayoutSettings => ({ ...s, [option]: !s[option] }));
  }

  public handleOpenColorsDialog(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(NodeColorsDialog, {
      header: 'Configure Node Colors',
    });
  }

  public handleLayoutReset(): void {
    this.handleSelectLayoutMode(this.settings().layout);
  }

  private computeGraphKey(data: GraphData): string {
    const nodeKeyParts: string[] = [...data.nodes].map(
      (n: GraphNode): string => `${n.id}|${n.label}|${n.superType}|${n.baseName}|${n.modelName}`,
    );
    const nodeKey: string = nodeKeyParts.sort().join(',');

    const linkKeyParts: string[] = [...data.links].map((l: GraphLink): string => `${l.id}|${l.label}|${l.source}->${l.target}`);
    const linkKey: string = linkKeyParts.sort().join(',');

    return `n:${data.nodes.length}:${nodeKey}#l:${data.links.length}:${linkKey}`;
  }
}
