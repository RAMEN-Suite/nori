import { Component, effect, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { GraphComponent } from '../graph/graph.component';
import { GModel } from '../../../../core/models/GModel';
import { GModelGraph, GraphData } from '../../../../core/GModelGraph';
import { WorkspaceService } from '../../../../services/workspace.service';
import { FormsModule } from '@angular/forms';
import { Menubar } from 'primeng/menubar';
import {
  DEFAULT_GRAPH_LAYOUT_SETTINGS,
  GraphLayoutMode,
  GraphLayoutSettings,
} from '../graph/graph.types';
import { SelectButton } from 'primeng/selectbutton';
import { ToggleButton } from 'primeng/togglebutton';
import { Tooltip } from 'primeng/tooltip';

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
  imports: [GraphComponent, FormsModule, Menubar, SelectButton, ToggleButton, Tooltip],
  templateUrl: './visualizer.component.html',
  styleUrl: './visualizer.component.scss',
})
export class VisualizerComponent implements OnInit {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected graphData: WritableSignal<GraphData> = signal({ nodes: [], links: [] });

  protected settings: WritableSignal<GraphLayoutSettings> = signal({
    ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
    padding: { ...DEFAULT_GRAPH_LAYOUT_SETTINGS.padding },
  });

  protected layoutOptions: LayoutOption[] = [];
  protected toggleOptions: ToggleOption[] = [];

  constructor() {
    effect((): void => {
      const model: GModel | null = this.workspace.derivedModel();
      if (!model) return;
      this.graphData.set(new GModelGraph().build(model));
    });
  }

  public ngOnInit(): void {
    this.layoutOptions = [
      { label: 'Cluster', icon: 'pi pi-share-alt', mode: 'clusterTopDown' },
      { label: 'Tree', icon: 'pi pi-sitemap', mode: 'treeTopDown' },
    ];

    this.toggleOptions = [
      {
        onIcon: 'pi pi-eye-slash',
        offIcon: 'pi pi-eye',
        tooltip: 'Toggle Isolated Nodes',
        option: 'areIsolatedNodesHidden',
      },
    ];
  }

  public handleSelectMode(layoutMode: GraphLayoutMode): void {
    this.settings.update((s: GraphLayoutSettings): GraphLayoutSettings => ({ ...s, layoutMode }));
  }

  public handleToggleOption(option: LayoutToggleOption): void {
    this.settings.update(
      (s: GraphLayoutSettings): GraphLayoutSettings => ({ ...s, [option]: !s[option] }),
    );
  }
}
