import { Component, computed, DestroyRef, inject, Signal, signal, WritableSignal } from '@angular/core';
import { GraphComponent } from '../graph/graph.component';
import { GModel } from '../../../../../core/models/GModel';
import { GModelGraph, GraphData, GraphLink, GraphNode } from '../../../../../core/utils/GModelGraph';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { FormsModule } from '@angular/forms';
import { Menubar } from 'primeng/menubar';
import { DEFAULT_GRAPH_LAYOUT_SETTINGS, GraphLayoutMode, GraphLayoutSettings } from '../graph/graph.types';
import { SelectButton } from 'primeng/selectbutton';
import { ToggleButton } from 'primeng/togglebutton';
import { Tooltip } from 'primeng/tooltip';
import { Button } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { NodeColorsDialog } from '../../../dialogs/node-colors/node-colors.dialog';

type LayoutToggleOption = 'areIsolatedNodesHidden';

interface ToggleOption {
  onIcon: string;
  offIcon: string;
  tooltip: string;
  option: LayoutToggleOption;
}

interface LayoutOption {
  label: string;
  icon: string;
  mode: GraphLayoutMode;
}

@Component({
  selector: 'app-visualizer',
  imports: [GraphComponent, FormsModule, Menubar, SelectButton, ToggleButton, Tooltip, Button],
  providers: [DialogService],
  templateUrl: './graph-menu.component.html',
  styleUrl: './graph-menu.component.scss',
})
export class GraphMenuComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DynamicDialogRef | null = null;

  protected layoutOptions: LayoutOption[] = [
    { label: 'Cluster', icon: 'pi pi-share-alt', mode: 'clusterTopDown' },
    { label: 'Tree', icon: 'pi pi-sitemap', mode: 'treeTopDown' },
  ];

  protected toggleOptions: ToggleOption[] = [
    {
      onIcon: 'pi pi-eye-slash',
      offIcon: 'pi pi-eye',
      tooltip: 'Toggle Isolated Nodes',
      option: 'areIsolatedNodesHidden',
    },
  ];

  protected settings: WritableSignal<GraphLayoutSettings> = signal({
    ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
    padding: { ...DEFAULT_GRAPH_LAYOUT_SETTINGS.padding },
  });

  protected graphData: Signal<GraphData> = computed((): GraphData => {
    const model: GModel | null = this.workspace.store.currentModel();
    const graphData: GraphData = new GModelGraph().build(model);

    const key: string = this.computeGraphKey(graphData);
    if (key === this.previousKey) return this.previousData;

    this.previousKey = key;
    this.previousData = graphData;

    return graphData;
  });

  private previousKey: string = '';
  private previousData: GraphData = { nodes: [], links: [] };

  constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  public handleSelectLayoutMode(layoutMode: GraphLayoutMode): void {
    this.settings.update((s: GraphLayoutSettings): GraphLayoutSettings => ({ ...s, layoutMode }));
  }

  public handleToggleOption(option: LayoutToggleOption): void {
    this.settings.update((s: GraphLayoutSettings): GraphLayoutSettings => ({ ...s, [option]: !s[option] }));
  }

  public handleOpenColorsDialog(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(NodeColorsDialog, {
      header: 'Configure Node Colors',
      closeOnEscape: true,
      dismissableMask: true,
      draggable: true,
      closable: true,
    });
  }

  public handleLayoutReset(): void {
    this.handleSelectLayoutMode(this.settings().layoutMode);
  }

  private computeGraphKey(data: GraphData): string {
    const nodeKeyParts: string[] = [...data.nodes].map((n: GraphNode): string => `${n.id}|${n.label}`);
    const nodeKey: string = nodeKeyParts.sort().join(',');

    const linkKeyParts: string[] = [...data.links].map((l: GraphLink): string => `${l.id}|${l.source}->${l.target}`);
    const linkKey: string = linkKeyParts.sort().join(',');

    return `n:${data.nodes.length}:${nodeKey}#l:${data.links.length}:${linkKey}`;
  }
}
