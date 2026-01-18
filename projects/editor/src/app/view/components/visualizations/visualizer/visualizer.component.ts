import { Component, effect, inject, signal, WritableSignal } from '@angular/core';
import { GraphComponent } from '../graph/graph.component';
import { GModel } from '../../../../core/models/GModel';
import { GModelGraph, GraphData } from '../../../../core/GModelGraph';
import { WorkspaceService } from '../../../../services/workspace.service';
import { FormsModule } from '@angular/forms';
import { Menubar } from 'primeng/menubar';
import { DEFAULT_GRAPH_LAYOUT_SETTINGS, GraphLayoutSettings } from '../graph/graph.types';

@Component({
  selector: 'app-visualizer',
  imports: [GraphComponent, FormsModule, Menubar],
  templateUrl: './visualizer.component.html',
  styleUrl: './visualizer.component.scss',
})
export class VisualizerComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected graphData: WritableSignal<GraphData> = signal({ nodes: [], links: [] });

  protected settings: WritableSignal<GraphLayoutSettings> = signal({
    ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
    padding: { ...DEFAULT_GRAPH_LAYOUT_SETTINGS.padding },
  });

  constructor() {
    effect((): void => {
      const model: GModel | null = this.workspace.derivedModel();
      if (!model) return;
      this.graphData.set(new GModelGraph().build(model));
    });
  }
}
