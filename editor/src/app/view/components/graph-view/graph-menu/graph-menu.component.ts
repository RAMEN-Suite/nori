import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  viewChild,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideMousePointer2, LucidePlus } from '@lucide/angular';
import { ModelRef, type Model, type NodeSuggestion } from '@ramen-suite/core/model';
import { Button } from '@sushi-kit/angular';
import { areGraphsEqual, ModelGraph, type GraphData } from '../../../../core/utils/ModelGraph';
import { DialogService, type DialogRef } from '../../../../services/dialog.service';
import { NodeEditingService } from '../../../../services/workspace/node-editing.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { NodeColorsDialog } from '../../dialogs/node-colors/node-colors.dialog';
import { GraphComponent } from '../graph/graph.component';
import {
  DEFAULT_GRAPH_LAYOUT_SETTINGS,
  DEFAULT_GRAPH_PADDING,
  type GraphLayoutSettings,
  type GraphPadding,
} from '../graph/graph.types';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-graph-menu',
  imports: [GraphComponent, Button, TranslocoDirective, LucideMousePointer2, LucidePlus],
  templateUrl: './graph-menu.component.html',
})
export class GraphMenuComponent {
  protected readonly nodeEditing: NodeEditingService = inject(NodeEditingService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly dialogs: DialogService = inject(DialogService);

  public readonly canvasPadding: InputSignal<GraphPadding> = input<GraphPadding>(DEFAULT_GRAPH_PADDING);
  public readonly nodeSelected: OutputEmitterRef<void> = output();

  private dialogRef: DialogRef | null = null;
  private readonly graph: Signal<GraphComponent | undefined> = viewChild(GraphComponent);

  protected readonly settings: Signal<GraphLayoutSettings> = computed(
    (): GraphLayoutSettings => ({
      ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
      padding: this.canvasPadding(),
    }),
  );
  protected readonly graphData: Signal<GraphData> = computed(
    (): GraphData => {
      const model: Model | null = this.workspace.store.currentModel();
      const visible: readonly string[] = this.workspace.store.currentModelRecord()?.view?.visibleNodeRefs ?? [];
      const allowed: Set<string> = new Set(this.workspace.view.nodeSuggestions().map((node: NodeSuggestion): string => node.ref));

      return new ModelGraph().build(
        model,
        this.workspace.store.getModels(),
        visible.filter((ref: string): boolean => allowed.has(ref)),
      );
    },
    { equal: areGraphsEqual },
  );
  protected readonly startingNodes: Signal<readonly { name: string; ref: string }[]> = computed(() => {
    const model: Model | null = this.workspace.view.baseModel();
    if (!model) return [];
    return this.workspace.view.baseNodes().map((node) => ({ name: node.name, ref: ModelRef.qualify(model.id, node.id) }));
  });

  public constructor() {
    this.destroyRef.onDestroy((): void => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  public handleOpenColorsDialog(): void {
    this.dialogRef?.close();
    this.dialogRef = this.dialogs.open(NodeColorsDialog, {
      closeOnBackdrop: true,
      width: '28rem',
      headerKey: 'editor.adjustNodeColours',
    });
  }

  public handleLayoutReset(): void {
    this.graph()?.resetView();
  }

  public handleFitView(): void {
    this.graph()?.fitView();
  }
}
