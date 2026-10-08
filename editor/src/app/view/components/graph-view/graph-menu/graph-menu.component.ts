import { LucideMousePointer2, LucidePlus } from '@lucide/angular';
import {
  Component,
  input,
  effect,
  type InputSignal,
  output,
  type OutputEmitterRef,
  computed,
  DestroyRef,
  inject,
  Signal,
  signal,
  WritableSignal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { GraphComponent } from '../graph/graph.component';
import { Model } from '@ramen-suite/core/model';
import { ModelGraph, GraphData, GraphLink, GraphNode } from '../../../../core/utils/ModelGraph';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import {
  DEFAULT_GRAPH_LAYOUT_SETTINGS,
  DEFAULT_GRAPH_PADDING,
  GraphLayoutSettings,
  type GraphPadding,
} from '../graph/graph.types';
import { TranslocoDirective } from '@jsverse/transloco';
import { CreateNodeDialog } from '../../dialogs/create-node/create-node.dialog';
import { Button } from '@sushi-kit/angular';
import { DialogService, DialogRef } from '../../../../services/dialog.service';
import { NodeColorsDialog } from '../../dialogs/node-colors/node-colors.dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-visualizer',
  imports: [GraphComponent, Button, TranslocoDirective, LucideMousePointer2, LucidePlus],
  templateUrl: './graph-menu.component.html',
})
export class GraphMenuComponent {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly dialogService: DialogService = inject(DialogService);
  protected dialogRef: DialogRef | null = null;

  private readonly settingsState: WritableSignal<GraphLayoutSettings> = signal({
    ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
    padding: { ...DEFAULT_GRAPH_LAYOUT_SETTINGS.padding },
  });

  public readonly settings: Signal<GraphLayoutSettings> = this.settingsState.asReadonly();

  protected readonly graphData: Signal<GraphData> = computed((): GraphData => {
    const model: Model | null = this.workspace.store.currentModel();
    const graphData: GraphData = new ModelGraph().build(model, this.workspace.store.getModels());

    const key: string = this.computeGraphKey(graphData);
    if (key === this.previousKey) return this.previousData;

    this.previousKey = key;
    this.previousData = graphData;

    return graphData;
  });

  private readonly graph: Signal<GraphComponent | undefined> = viewChild(GraphComponent);

  private previousKey: string = '';
  private previousData: GraphData = { nodes: [], links: [] };

  public readonly canvasPadding: InputSignal<GraphPadding> = input<GraphPadding>(DEFAULT_GRAPH_PADDING);
  public readonly nodeSelected: OutputEmitterRef<void> = output();

  public constructor() {
    effect((): void => {
      const padding: GraphPadding = this.canvasPadding();
      this.settingsState.update((settings: GraphLayoutSettings): GraphLayoutSettings => ({ ...settings, padding }));
    });

    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  protected handleCreate(): void {
    this.dialogService.open(CreateNodeDialog, { headerKey: 'editor.createNode' });
  }

  public handleOpenColorsDialog(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogService.open(NodeColorsDialog, {
      headerKey: 'editor.colours',
    });
  }

  public handleLayoutReset(): void {
    this.graph()?.resetView();
  }

  public handleFitView(): void {
    this.graph()?.fitView();
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
