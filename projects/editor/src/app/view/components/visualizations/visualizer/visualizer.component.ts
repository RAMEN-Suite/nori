import { Component, effect, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { GraphComponent } from '../graph/graph.component';
import { GModel } from '../../../../models/GModel';
import { GModelGraph, GraphData } from '../../../../core/GModelGraph';
import { WorkspaceService } from '../../../../services/workspace.service';
import { Menubar } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-visualizer',
  imports: [GraphComponent, Menubar],
  templateUrl: './visualizer.component.html',
  styleUrl: './visualizer.component.scss',
})
export class VisualizerComponent implements OnInit {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected graphData: WritableSignal<GraphData> = signal({ nodes: [], links: [] });

  protected menuItems: MenuItem[] = [];

  constructor() {
    effect(() => {
      const model: GModel | null = this.workspace.derivedModel();
      if (!model) return;
      this.graphData.set(new GModelGraph().build(model));
      console.log(this.workspace.validation());
    });
  }

  public ngOnInit(): void {
    this.menuItems = [
      {
        label: 'test',
      },
    ];
  }
}
