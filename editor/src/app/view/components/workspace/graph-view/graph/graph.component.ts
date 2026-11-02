import {
  type AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  type WritableSignal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { type Node as ModelNode } from '@ramen-suite/core/model';
import { Input } from '@sushi-kit/angular';
import type { ZoomTransform } from 'd3';
import * as d3 from 'd3';
import { toCamelName, toPascalName } from '../../../../../utils/model-names';
import type { GraphData } from './model-graph';
import { AutoselectDirective } from '../../../../../directives/autoselect.directive';
import { type GraphView, type ModelRecord } from '../../../../../models/ModelRecord';
import { NavigationService } from '../../../../../services/interaction/navigation.service';
import { ProjectService } from '../../../../../services/projects/project.service';
import { ExportService } from '../../../../../services/persistence/export.service';
import { type GraphTool, GraphToolsService } from '../../../../../services/workspace/editing/graph-tools.service';
import { NodeEditingService } from '../../../../../services/workspace/editing/node-editing.service';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { ApplicationState } from '../../../../../states/application.state';
import { GraphModeHintComponent } from '../graph-mode-hint/graph-mode-hint.component';
import { NodeActionsComponent } from '../node-actions/node-actions.component';
import { RelationActionsComponent } from '../relation-actions/relation-actions.component';
import { GraphAutoLayout, type NodePosition } from './graph.auto-layout';
import { getLinkPath } from './graph.geometry';
import { positionLinkLabels } from './graph.labels';
import { buildRenderModel, getViewportSize, placeNodes, placeRamenNodes, setNodePosition } from './graph.layout';
import { GraphImageExport, type GraphImageFormat } from './graph.image-export';
import { GraphViewport } from './graph.viewport';
import { GraphRenderer } from './graph.renderer';
import {
  DEFAULT_GRAPH_LAYOUT_SETTINGS,
  GRAPH_NODE_WIDTH,
  GRAPH_NODE_HEIGHT,
  type GraphLayoutSettings,
  type GraphPadding,
  type LinkSelection,
  type NodeDrag,
  type NodeSelection,
  type PositionedNode,
  type RenderModel,
  type ResolvedLink,
  type RootSelection,
  type SVGSelection,
  type ViewportSize,
} from './graph.types';

/** Coordinates graph rendering, editing gestures and saved model views. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-graph',
  encapsulation: ViewEncapsulation.None,
  imports: [
    GraphModeHintComponent,
    TranslocoDirective,
    NodeActionsComponent,
    RelationActionsComponent,
    FormsModule,
    Input,
    AutoselectDirective,
  ],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.scss',
})
export class GraphComponent implements AfterViewInit {
  protected readonly graphTools: GraphToolsService = inject(GraphToolsService);
  private readonly nodeEditing: NodeEditingService = inject(NodeEditingService);
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly export: ExportService = inject(ExportService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly navigation: NavigationService = inject(NavigationService);

  public readonly graphData: InputSignal<GraphData> = input<GraphData>({ nodes: [], links: [] });
  public readonly settings: InputSignal<GraphLayoutSettings> = input({
    ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
    padding: { ...DEFAULT_GRAPH_LAYOUT_SETTINGS.padding },
  });
  public readonly nodeSelected: OutputEmitterRef<void> = output();

  private readonly host: Signal<ElementRef<HTMLDivElement> | undefined> = viewChild('host');

  protected readonly nodeActionsPosition: WritableSignal<{ x: number; y: number } | null> = signal(null);
  protected readonly relationActionsPosition: WritableSignal<{ x: number; y: number } | null> = signal(null);
  protected readonly nameEditorPosition: WritableSignal<{ x: number; y: number; width: number } | null> = signal(null);
  protected readonly renamingNode: WritableSignal<{ id: string; modelId: string } | null> = signal(null);
  protected readonly draftName: WritableSignal<string> = signal('');
  protected readonly savingName: WritableSignal<boolean> = signal(false);

  private readonly autoLayout: GraphAutoLayout = new GraphAutoLayout();
  private layoutRequest: number = 0;
  private readonly renderer: GraphRenderer = new GraphRenderer(this.translations);

  private connectionTimer: number | null = null;
  private eraseTargetId: string | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private dragMoved: boolean = false;

  private svgSelection?: SVGSelection;
  private rootGroupSelection?: RootSelection;
  private viewport?: GraphViewport;
  private nodeSelection?: NodeSelection;
  private linkSelection?: LinkSelection;
  private renderModel?: RenderModel;

  private readonly frames: Set<number> = new Set();

  private previousGraphData?: GraphData;
  private previousSettings?: GraphLayoutSettings;
  private recordId: string | null = null;

  public constructor() {
    this.translations.langChanges$.pipe(takeUntilDestroyed()).subscribe((): void => {
      if (this.nodeSelection) this.renderer.updateNodeLabels(this.nodeSelection);
      this.updateLinkAccessibility();
    });

    effect((): void => {
      const tool: GraphTool = this.graphTools.tool();
      this.cancelScheduledConnection();
      const selected: string | null = untracked((): string | null => this.workspace.store.currentNodeId());
      if (tool === 'connect' && selected) this.graphTools.selectSource(selected);
      this.rootGroupSelection?.selectAll('.connection-preview').remove();
      this.svgSelection?.classed('is-connecting', tool === 'connect').classed('is-erasing', tool === 'erase');
      this.updateLinkAccessibility();
      this.updateOverlaysPosition();
    });

    effect((): void => {
      if (this.graphTools.source()) return;
      this.rootGroupSelection?.selectAll('.connection-preview').remove();
      this.cancelScheduledConnection();
    });

    effect((): void => {
      this.refreshHover();
      this.updateOverlaysPosition();
    });
    this.registerColorChangesEffect();
    this.registerGraphChangesEffect();
  }

  public ngAfterViewInit(): void {
    this.mountSvg();
    this.render(this.graphData());
    this.destroyRef.onDestroy((): void => this.cleanup());
  }

  public fitView(): void {
    this.fitViewport(this.appearance.state().animations ? 400 : 0);
    if (!this.appearance.state().animations) this.saveView();
  }

  public resetView(): void {
    void this.resetLayout().catch((error: unknown): void => this.projects.reportError(error));
  }

  public async exportImage(format: GraphImageFormat): Promise<void> {
    const svg: SVGSVGElement | null | undefined = this.svgSelection?.node();
    const root: SVGGElement | null | undefined = this.rootGroupSelection?.node();
    if (!svg || !root || !this.renderModel?.nodes.length) return;
    const name: string = toCamelName(this.workspace.store.currentModelRecord()?.name ?? 'model').toLowerCase();
    try {
      const snapshot: Blob = GraphImageExport.svg(svg, root);
      const image: Blob = format === 'svg' ? snapshot : await GraphImageExport.png(snapshot);
      await this.export.exportBlob(image, `${name}.${format}`, format.toUpperCase());
    } catch (error: unknown) {
      this.projects.reportError(error);
    }
  }

  private async resetLayout(): Promise<void> {
    const model: RenderModel | undefined = this.renderModel;
    if (!model?.nodes.length) return;
    const request: number = ++this.layoutRequest;
    if (this.workspace.store.currentLevelIndex() === 0) {
      const nodes: PositionedNode[] = model.nodes.map((node: PositionedNode): PositionedNode => ({ ...node }));
      if (placeRamenNodes(nodes)) {
        this.animateLayout(model, new Map(nodes.map((node: PositionedNode): [string, NodePosition] => [node.id, node])));
      }
      return;
    }
    const positions: ReadonlyMap<string, NodePosition> = await this.autoLayout.arrange(model);
    if (this.destroyRef.destroyed || request !== this.layoutRequest || model !== this.renderModel) return;

    this.animateLayout(model, positions);
  }

  private animateLayout(model: RenderModel, positions: ReadonlyMap<string, NodePosition>): void {
    const starts: Map<string, NodePosition> = new Map(
      model.nodes.map((node: PositionedNode): [string, NodePosition] => [node.id, { x: node.x, y: node.y }]),
    );
    const move: (progress: number) => void = (progress: number): void => {
      for (const node of model.nodes) {
        const start: NodePosition | undefined = starts.get(node.id);
        const target: NodePosition | undefined = positions.get(node.id);
        if (start && target)
          setNodePosition(node, start.x + (target.x - start.x) * progress, start.y + (target.y - start.y) * progress);
      }
      this.updateNodePositions();
      this.updateLinkPositions();
    };
    this.rootGroupSelection?.interrupt('layout');
    if (!this.appearance.state().animations) {
      move(1);
      this.fitView();
      return;
    }
    this.rootGroupSelection
      ?.transition('layout')
      .duration(450)
      .ease(d3.easeCubicInOut)
      .tween('positions', (): ((progress: number) => void) => move)
      .on('end', (): void => this.fitView());
  }

  private registerColorChangesEffect(): void {
    effect((): void => {
      this.workspace.store.currentNodeColors();
      untracked((): void => this.updateNodeColors());
    });
  }

  private registerGraphChangesEffect(): void {
    effect((): void => {
      const data: GraphData = this.graphData();
      const settings: GraphLayoutSettings = this.settings();
      const recordId: string | null = this.workspace.store.currentModelRecord()?.modelId ?? null;

      if (!this.rootGroupSelection) return;

      const hasGraphChanged: boolean = this.previousGraphData !== data;
      const haveSettingsChanged: boolean = this.previousSettings !== settings;
      if (!hasGraphChanged && !haveSettingsChanged && this.recordId === recordId) return;

      this.previousGraphData = data;
      this.previousSettings = settings;

      untracked((): void => {
        this.render(data);
      });
    });
  }

  private mountSvg(): void {
    if (this.svgSelection) return;
    const hostElement: HTMLDivElement = this.getHostElement();

    this.svgSelection = d3
      .select(hostElement)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('user-select', 'none')
      .on('click', (event: MouseEvent): void => this.handleBackgroundClick(event));

    this.rootGroupSelection = this.svgSelection.append('g');
    this.renderer.drawArrowMarker(this.svgSelection);

    this.viewport = new GraphViewport(hostElement, this.svgSelection, this.rootGroupSelection, {
      onTransformChange: (): void => this.updateOverlaysPosition(),
      onTransformEnd: (): void => this.saveView(),
    });
  }

  private get viewTransform(): ZoomTransform {
    return this.viewport?.transform ?? d3.zoomIdentity;
  }

  private render(data: GraphData): void {
    this.layoutRequest++;
    this.rootGroupSelection?.interrupt('layout');
    if (!this.rootGroupSelection) return;
    const record: ModelRecord | null = untracked((): ModelRecord | null => this.workspace.store.currentModelRecord());
    const recordId: string | null = record?.modelId ?? null;

    const changedLevel: boolean = this.recordId !== recordId;
    const saved: GraphView | undefined = changedLevel ? record?.view?.graph : undefined;
    const previous: RenderModel | undefined = changedLevel ? undefined : this.renderModel;
    const viewport: ViewportSize = getViewportSize(this.getHostElement());
    const model: RenderModel = buildRenderModel({
      data,
      settings: { ...this.settings(), padding: this.getCanvasPadding() },
      viewport,
    });
    const needsFit: boolean = this.restorePositions(model, previous, saved);

    this.recordId = recordId;
    this.renderModel = model;
    this.linkSelection = this.renderer.drawLinks(this.rootGroupSelection, model.links);
    this.nodeSelection = this.renderer.drawNodes(this.rootGroupSelection, model.nodes);
    this.bindGraphEvents();
    this.updateLinkPositions();
    this.updateNodePositions();
    this.updateNodeColors();
    this.refreshHover();

    this.restoreViewport(saved, !previous?.nodes.length, needsFit);
    if (record) this.saveView();
  }

  private restorePositions(model: RenderModel, previous: RenderModel | undefined, saved: GraphView | undefined): boolean {
    if (!previous && !saved) return false;

    const retained: PositionedNode[] = [];
    const added: PositionedNode[] = [];
    for (const node of model.nodes) {
      const position: { x: number; y: number } | undefined = previous?.nodesById.get(node.id) ?? saved?.positions[node.id];
      const collides: boolean =
        !!position &&
        retained.some(
          (other: PositionedNode): boolean =>
            Math.abs(other.x - position.x) < GRAPH_NODE_WIDTH + 16 && Math.abs(other.y - position.y) < 80,
        );
      if (position && !collides) {
        setNodePosition(node, position.x, position.y);
        retained.push(node);
      } else added.push(node);
    }

    const transform: ZoomTransform = saved
      ? d3.zoomIdentity.translate(saved.viewport.x, saved.viewport.y).scale(saved.viewport.scale)
      : this.viewTransform;
    return placeNodes(added, retained, getViewportSize(this.getHostElement()), this.getCanvasPadding(), transform);
  }

  private restoreViewport(saved: GraphView | undefined, fit: boolean, needsFit: boolean): void {
    if (needsFit) {
      this.fitViewport(0);
    } else if (saved) {
      this.viewport?.applyTransform(d3.zoomIdentity.translate(saved.viewport.x, saved.viewport.y).scale(saved.viewport.scale), 0);
    } else if (fit) {
      this.fitViewport(0);
    }
  }

  private bindGraphEvents(): void {
    this.nodeSelection
      ?.call(this.createDragBehavior())
      .on('mouseenter', this.handleNodeHover.bind(this))
      .on('mouseleave', this.handleNodeLeave.bind(this))
      .on('click', this.handleNodeClick.bind(this))
      .on('dblclick', this.handleNodeDoubleClick.bind(this))
      .on('keydown', this.handleNodeKeyDown.bind(this));

    this.linkSelection?.on('click', this.handleLinkClick.bind(this));
    this.rootGroupSelection
      ?.selectAll<SVGElement, ResolvedLink>('path.link-hit, text.link-label')
      .on('click', this.handleLinkClick.bind(this))
      .on('mouseenter focus', (_: Event, link: ResolvedLink): void => this.highlightRelation(link.id))
      .on('mouseleave blur', (): void => {
        const active: Element | null = document.activeElement;
        const focused: ResolvedLink | undefined = active?.classList.contains('link-hit')
          ? d3.select<Element, ResolvedLink>(active).datum()
          : undefined;
        this.highlightRelation(focused?.id ?? null);
      })
      .on('keydown', (event: KeyboardEvent, link: ResolvedLink): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.handleLinkClick(event, link);
      });
    this.updateLinkAccessibility();
  }

  private updateNodeColors(): void {
    this.nodeSelection?.style('--g-node-fill', (node: PositionedNode): string => this.getNodeColor(node));
  }

  private getNodeColor(node: PositionedNode): string {
    return this.workspace.store.currentNodeColors()[node.superType] ?? 'var(--color-base-300)';
  }

  private updateNodePositions(): void {
    this.nodeSelection?.attr('transform', (node: PositionedNode): string => `translate(${node.x}, ${node.y})`);
    this.updateOverlaysPosition();
  }

  private updateOverlaysPosition(): void {
    this.updateNameEditorPosition();
    this.updateRelationActionsPosition();
    const selectedId: string | null = this.workspace.store.currentNodeId();
    const node: PositionedNode | undefined = selectedId ? this.renderModel?.nodesById.get(selectedId) : undefined;
    if (!node || this.renamingNode() || !this.workspace.queries.editable() || this.graphTools.tool() !== 'select') {
      this.nodeActionsPosition.set(null);
      return;
    }

    this.nodeActionsPosition.set({
      x: this.viewTransform.applyX(node.x),
      y: this.viewTransform.applyY(node.y - GRAPH_NODE_HEIGHT / 2) - 14,
    });
  }

  private updateRelationActionsPosition(): void {
    const relationId: string | null = this.workspace.store.currentRelationId();
    const label: SVGTextElement | null | undefined = this.rootGroupSelection
      ?.selectAll<SVGTextElement, ResolvedLink>('text.link-label')
      .filter((link: ResolvedLink): boolean => link.id === relationId)
      .node();
    if (!label || this.renamingNode() || !this.workspace.queries.editable() || this.graphTools.tool() !== 'select') {
      this.relationActionsPosition.set(null);
      return;
    }

    const bounds: DOMRect = label.getBBox();
    this.relationActionsPosition.set({
      x: this.viewTransform.applyX(bounds.x + bounds.width / 2),
      y: this.viewTransform.applyY(bounds.y) - 14,
    });
  }

  private updateNameEditorPosition(): void {
    const renaming: { id: string; modelId: string } | null = this.renamingNode();
    const editingNode: PositionedNode | undefined = renaming ? this.renderModel?.nodesById.get(renaming.id) : undefined;
    if (
      editingNode &&
      renaming?.modelId === this.workspace.store.currentModel()?.id &&
      this.workspace.queries.editable() &&
      this.graphTools.tool() === 'select'
    ) {
      this.nameEditorPosition.set({
        x: this.viewTransform.applyX(editingNode.x),
        y: this.viewTransform.applyY(editingNode.y - 10),
        width: Math.max(140, (GRAPH_NODE_WIDTH - 16) * this.viewTransform.k),
      });
    } else {
      this.renamingNode.set(null);
      this.nameEditorPosition.set(null);
    }
  }

  private updateLinkPositions(): void {
    if (!this.linkSelection || !this.rootGroupSelection || !this.renderModel) return;
    const nodes: PositionedNode[] = this.renderModel.nodes;
    const paths: Map<string, string> = new Map(
      this.renderModel.links.map((link: ResolvedLink): [string, string] => [link.id, getLinkPath(link, nodes)]),
    );
    this.linkSelection.attr('d', (link: ResolvedLink): string => paths.get(link.id) ?? '');
    this.rootGroupSelection
      .selectAll<SVGPathElement, ResolvedLink>('path.link-hit')
      .attr('d', (link: ResolvedLink): string => paths.get(link.id) ?? '');
    positionLinkLabels(this.rootGroupSelection, this.linkSelection, nodes);
    this.updateRelationActionsPosition();
    this.highlightRelation(this.eraseTargetId);
  }

  private updateLinkAccessibility(): void {
    const removing: boolean = this.graphTools.tool() === 'erase';
    this.highlightRelation(null);
    this.nodeSelection?.select('rect.node-body').attr('aria-label', (node: PositionedNode): string => {
      if (!removing) return `${node.label}, ${node.baseName || node.modelName}`;
      return this.translations.translate(
        this.workspace.queries.currentNodesById().has(node.id) ? 'editor.eraseNamedNode' : 'editor.hideBaseNode',
        { name: node.label },
      );
    });
    const active: Element | null = document.activeElement;
    if (this.graphTools.tool() === 'connect' && active?.classList.contains('link-hit')) {
      this.focusSelectedNode();
    }
    this.rootGroupSelection
      ?.selectAll<SVGPathElement, ResolvedLink>('path.link-hit')
      .attr('role', this.graphTools.tool() !== 'connect' ? 'button' : null)
      .attr('tabindex', this.graphTools.tool() !== 'connect' ? 0 : -1)
      .attr('aria-hidden', this.graphTools.tool() !== 'connect' ? null : 'true')
      .attr('aria-label', (link: ResolvedLink): string | null =>
        this.translations.translate(removing ? 'editor.removeNamedConnection' : 'editor.selectNamedRelation', {
          name: link.label,
          from: link.source.label,
          to: link.target.label,
        }),
      );
  }

  private highlightRelation(id: string | null): void {
    this.eraseTargetId = this.graphTools.tool() === 'erase' ? id : null;
    this.rootGroupSelection
      ?.selectAll<SVGElement, ResolvedLink>('path.link, text.link-label')
      .classed('is-erase-target', (link: ResolvedLink): boolean => link.id === this.eraseTargetId);
    if (!this.rootGroupSelection || !this.renderModel) return;
    const targetId: string | null =
      this.graphTools.tool() === 'select' ? (id ?? this.workspace.store.currentRelationId()) : this.eraseTargetId;
    this.renderer.drawRelationFeedback(this.rootGroupSelection, this.renderModel, targetId, this.graphTools.tool() === 'select');
  }

  private refreshHover(): void {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    if (selectedId && this.renderModel?.nodesById.has(selectedId)) this.applyHoverHighlight(selectedId);
    else this.clearHoverHighlight();
    this.applySelectedHighlight(selectedId);
    const relationId: string | null = this.workspace.store.currentRelationId();
    this.rootGroupSelection
      ?.selectAll<SVGElement, ResolvedLink>('path.link, text.link-label')
      .classed('is-selected', (link: ResolvedLink): boolean => link.id === relationId);
    this.rootGroupSelection
      ?.selectAll<SVGPathElement, ResolvedLink>('path.link-hit')
      .attr('aria-pressed', (link: ResolvedLink): string => String(link.id === relationId));
    this.highlightRelation(null);
  }

  private applySelectedHighlight(nodeId: string | null): void {
    this.nodeSelection?.classed('is-selected', (node: PositionedNode): boolean => node.id === nodeId);
  }

  private applyHoverHighlight(nodeId: string | null): void {
    if (!this.rootGroupSelection || !this.nodeSelection || !this.renderModel) return;
    this.renderer.applyHoverHighlight(this.rootGroupSelection, this.nodeSelection, this.renderModel, nodeId);
  }

  private clearHoverHighlight(): void {
    if (!this.rootGroupSelection || !this.nodeSelection) return;
    this.renderer.clearHoverHighlight(this.rootGroupSelection, this.nodeSelection);
  }

  private createDragBehavior(): NodeDrag {
    return d3
      .drag<SVGGElement, PositionedNode>()
      .filter((): boolean => this.graphTools.tool() !== 'erase' && !this.graphTools.pending())
      .on('start', (event: d3.D3DragEvent<SVGGElement, PositionedNode, unknown>): void => {
        this.layoutRequest++;
        this.rootGroupSelection?.interrupt('layout');
        if (this.graphTools.tool() === 'connect') {
          this.cancelScheduledConnection();
        }
        const [x, y]: [number, number] = d3.pointer(event.sourceEvent, this.rootGroupSelection?.node());
        this.dragStart = { x, y };
        this.dragMoved = false;
      })
      .on('drag', (event: d3.D3DragEvent<SVGGElement, PositionedNode, unknown>, node: PositionedNode): void => {
        if (this.graphTools.tool() === 'connect') {
          this.drawConnectionPreview(event, node);
          return;
        }
        setNodePosition(node, event.x, event.y);
        this.updateLinkPositions();
        this.updateNodePositions();
      })
      .on('end', (event: d3.D3DragEvent<SVGGElement, PositionedNode, unknown>, node: PositionedNode): void => {
        this.rootGroupSelection?.selectAll('.connection-preview').remove();
        if (this.graphTools.tool() === 'connect') this.finishConnection(event, node);
        else this.saveView();
        this.dragStart = null;
      });
  }

  private drawConnectionPreview(event: d3.D3DragEvent<SVGGElement, PositionedNode, unknown>, node: PositionedNode): void {
    const root: SVGGElement | null | undefined = this.rootGroupSelection?.node();
    if (!root || !this.rootGroupSelection || !this.dragStart) return;
    const [x, y]: [number, number] = d3.pointer(event.sourceEvent, root);
    if (!this.dragMoved) {
      if (Math.hypot(x - this.dragStart.x, y - this.dragStart.y) * this.viewTransform.k < 6) return;
      this.dragMoved = true;
      this.graphTools.selectSource(node.id);
    }
    if (this.graphTools.source() !== node.id) return;

    const preview: d3.Selection<SVGGElement, number, SVGGElement, unknown> = this.rootGroupSelection
      .selectAll<SVGGElement, number>('g.connection-preview')
      .data([0])
      .join('g')
      .attr('class', 'connection-preview')
      .style('--connection-color', this.getNodeColor(node));
    const bend: number = (x - this.dragStart.x) / 2;
    preview
      .selectAll('path')
      .data([0])
      .join('path')
      .attr(
        'd',
        `M${this.dragStart.x},${this.dragStart.y}C${this.dragStart.x + bend},${this.dragStart.y} ${x - bend},${y} ${x},${y}`,
      );
    preview.selectAll('circle').data([0]).join('circle').attr('cx', x).attr('cy', y).attr('r', 4);
  }

  private finishConnection(event: d3.D3DragEvent<SVGGElement, PositionedNode, unknown>, source: PositionedNode): void {
    if (!this.dragMoved || this.graphTools.source() !== source.id) return;
    const root: SVGGElement | null | undefined = this.rootGroupSelection?.node();
    if (!root) return;
    const [x, y]: [number, number] = d3.pointer(event.sourceEvent, root);
    const target: PositionedNode | undefined = this.renderModel?.nodes.find(
      (node: PositionedNode): boolean =>
        Math.abs(node.x - x) <= GRAPH_NODE_WIDTH / 2 && Math.abs(node.y - y) <= GRAPH_NODE_HEIGHT / 2,
    );
    this.graphTools.cancel();
    if (target) void this.graphTools.connect(source.id, target.id);
  }

  private handleNodeHover(_: MouseEvent, node: PositionedNode): void {
    this.applyHoverHighlight(node.id);
  }

  private handleNodeLeave(): void {
    this.refreshHover();
  }

  private handleNodeKeyDown(event: KeyboardEvent, node: PositionedNode): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    this.handleNodeClick(event, node);
  }

  private handleNodeClick(event: MouseEvent | KeyboardEvent, node: PositionedNode): void {
    event.stopPropagation();
    if (event instanceof MouseEvent && event.detail > 1) return;
    if (this.graphTools.pending()) return;
    if (this.graphTools.tool() === 'erase') {
      if (this.workspace.queries.currentNodesById().has(node.id)) this.nodeEditing.confirmRemoval(node.id);
      else this.nodeEditing.confirmCanvasRemoval(node.id);
      return;
    }
    if (this.graphTools.tool() === 'connect' && this.handleConnectionClick(event, node)) return;

    void this.navigation
      .navigateToNode(this.workspace.store.currentLevelIndex(), node.id)
      .then((): void => this.nodeSelected.emit())
      .catch((error: unknown): void => this.projects.reportError(error));
  }

  private handleConnectionClick(event: MouseEvent | KeyboardEvent, node: PositionedNode): boolean {
    const source: string | null = this.graphTools.source();
    if (!source) {
      this.graphTools.selectSource(node.id);
      return false;
    }
    if (source === node.id && event instanceof MouseEvent) return false;

    if (event instanceof MouseEvent) this.scheduleSingleClickConnection(source, node.id);
    else {
      this.graphTools.cancel();
      void this.graphTools.connect(source, node.id);
    }
    return true;
  }

  private handleNodeDoubleClick(event: MouseEvent, node: PositionedNode): void {
    if (this.graphTools.tool() === 'select') {
      const local: ModelNode | undefined = this.workspace.queries.currentNodesById().get(node.id);
      const modelId: string | undefined = this.workspace.store.currentModel()?.id;
      if (!local || !modelId || !this.workspace.queries.editable() || this.savingName()) return;
      event.preventDefault();
      event.stopPropagation();
      this.draftName.set(local.name);
      this.renamingNode.set({ id: node.id, modelId });
      this.updateOverlaysPosition();
      return;
    }
    if (this.graphTools.tool() !== 'connect') return;
    event.preventDefault();
    event.stopPropagation();
    this.cancelScheduledConnection();
    this.graphTools.cancel();
    void this.graphTools.connect(node.id, node.id);
  }

  protected handleCancelRename(restoreFocus: boolean = true): void {
    const id: string | undefined = this.renamingNode()?.id;
    this.renamingNode.set(null);
    this.nameEditorPosition.set(null);
    if (restoreFocus && id) {
      this.scheduleFrame((): void => {
        this.nodeSelection
          ?.filter((node: PositionedNode): boolean => node.id === id)
          .select<SVGRectElement>('rect.node-body')
          .node()
          ?.focus();
      });
    }
  }

  protected async handleSaveName(restoreFocus: boolean = false): Promise<void> {
    const editing: { id: string; modelId: string } | null = this.renamingNode();
    if (!editing || this.savingName()) return;
    if (editing.modelId !== this.workspace.store.currentModel()?.id || !this.workspace.queries.editable()) {
      this.handleCancelRename(false);
      return;
    }
    const enteredName: string = this.draftName().trim();
    if (!enteredName) {
      this.handleCancelRename(restoreFocus);
      return;
    }
    const name: string = toPascalName(enteredName);
    if (name === this.workspace.queries.currentNodesById().get(editing.id)?.name) {
      this.handleCancelRename(restoreFocus);
      return;
    }
    this.savingName.set(true);
    try {
      await this.workspace.actions.updateNode(editing.id, { name });
      if (this.renamingNode() === editing) this.handleCancelRename(restoreFocus);
    } catch (error: unknown) {
      this.projects.reportError(error);
    } finally {
      this.savingName.set(false);
    }
  }

  private handleLinkClick(event: MouseEvent | KeyboardEvent, link: ResolvedLink): void {
    event.stopPropagation();
    if (this.graphTools.tool() === 'erase') this.graphTools.remove(link.id);
    else if (this.graphTools.tool() === 'select') {
      void this.navigation
        .navigateToRelation(this.workspace.store.currentLevelIndex(), link.id)
        .then((): void => this.nodeSelected.emit())
        .catch((error: unknown): void => this.projects.reportError(error));
    }
  }

  private handleBackgroundClick(event: MouseEvent): void {
    const target: EventTarget | null = event.target;
    if (!(target instanceof Element)) return;

    const isOnNode: boolean = !!target.closest('g.node');
    const isOnLink: boolean = !!target.closest('path.link, path.link-hit, text.link-label');
    if (isOnNode || isOnLink) return;

    this.graphTools.cancel();
    void this.navigation
      .navigateToLevel(this.workspace.store.currentLevelIndex())
      .catch((error: unknown): void => this.projects.reportError(error));
  }

  private focusSelectedNode(): void {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    const target: SVGGElement | null | undefined =
      this.nodeSelection?.filter((node: PositionedNode): boolean => node.id === selectedId).node() ?? this.nodeSelection?.node();
    target?.querySelector<SVGRectElement>('rect.node-body')?.focus();
  }

  private getCanvasPadding(): GraphPadding {
    const root: HTMLElement = this.getHostElement().ownerDocument.documentElement;
    const scale: number = Number.parseFloat(window.getComputedStyle(root).fontSize) / 16;
    const padding: GraphPadding = this.settings().padding;
    return {
      top: padding.top * scale,
      bottom: padding.bottom * scale,
      left: padding.left * scale,
      right: padding.right * scale,
    };
  }

  private fitViewport(duration: number = 180): void {
    this.viewport?.fit(this.getCanvasPadding(), duration);
  }

  private saveView(): void {
    if (!this.renderModel || !this.recordId) return;
    const positions: GraphView['positions'] = Object.fromEntries(
      this.renderModel.nodes.map((node: PositionedNode): [string, { x: number; y: number }] => [
        node.id,
        { x: node.x, y: node.y },
      ]),
    );
    const graph: GraphView = {
      positions,
      viewport: { x: this.viewTransform.x, y: this.viewTransform.y, scale: this.viewTransform.k },
    };
    void this.workspace.actions
      .updateGraphView(this.recordId, graph)
      .catch((error: unknown): void => this.projects.reportError(error));
  }

  private getHostElement(): HTMLDivElement {
    const element: HTMLDivElement | undefined = this.host()?.nativeElement;
    if (!element) throw new Error('Cannot render graph without host element.');
    return element;
  }

  private scheduleSingleClickConnection(source: string, target: string): void {
    this.cancelScheduledConnection();
    this.connectionTimer = window.setTimeout((): void => {
      this.connectionTimer = null;
      this.graphTools.cancel();
      void this.graphTools.connect(source, target);
    }, 350);
  }

  private cancelScheduledConnection(): void {
    if (this.connectionTimer !== null) window.clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
  }

  private scheduleFrame(action: () => void): void {
    const id: number = window.requestAnimationFrame((): void => {
      this.frames.delete(id);
      if (!this.destroyRef.destroyed) action();
    });
    this.frames.add(id);
  }

  private cleanup(): void {
    this.autoLayout.destroy();
    this.layoutRequest++;
    this.rootGroupSelection?.interrupt('layout');
    this.cancelScheduledConnection();
    for (const id of this.frames) window.cancelAnimationFrame(id);
    this.frames.clear();
    this.viewport?.destroy();
    this.viewport = undefined;

    this.svgSelection?.remove();
    this.svgSelection = undefined;
    this.rootGroupSelection = undefined;

    this.nodeSelection = undefined;
    this.linkSelection = undefined;

    this.renderModel = undefined;
  }
}
