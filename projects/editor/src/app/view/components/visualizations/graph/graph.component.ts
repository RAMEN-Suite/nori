import {
  AfterViewInit,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  InputSignal,
  OnChanges,
  Signal,
  SimpleChanges,
  viewChild,
} from '@angular/core';
import * as d3 from 'd3';
import { D3ZoomEvent, Selection, ZoomBehavior } from 'd3';
import { GraphData, GraphNode } from '../../../../core/GModelGraph';
import {
  DEFAULT_GRAPH_LAYOUT_SETTINGS,
  GraphLayoutSettings,
  GraphPadding,
  NodeColorMap,
  PositionedNode,
  RenderModel,
  ResolvedLink,
  ViewportSize,
} from './graph.types';
import { buildRenderModel, getViewportSize } from './graph.layout';
import { WorkspaceService } from '../../../../services/workspace.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-graph',
  imports: [],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.scss',
})
export class GraphComponent implements AfterViewInit, OnChanges {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly router: Router = inject(Router);
  protected readonly activatedRoute: ActivatedRoute = inject(ActivatedRoute);

  protected readonly destroyRef: DestroyRef = inject(DestroyRef);

  protected svgSelection?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  protected rootGroupSelection?: d3.Selection<SVGGElement, unknown, null, undefined>;
  protected zoomBehavior?: ZoomBehavior<SVGSVGElement, unknown>;

  protected nodeSelection?: d3.Selection<SVGGElement, PositionedNode, SVGGElement, unknown>;
  protected linkSelection?: d3.Selection<SVGLineElement, ResolvedLink, SVGGElement, unknown>;

  protected animationFrameId: number | null = null;
  protected renderModel?: RenderModel;
  protected resizeObserver?: ResizeObserver;

  protected readonly host: Signal<ElementRef<HTMLDivElement> | undefined> = viewChild('host');

  public graphData: InputSignal<GraphData> = input({ nodes: [], links: [] } as GraphData);
  public fallbackColor: InputSignal<string> = input('currentColor');
  public superTypeColors: InputSignal<NodeColorMap> = input({});
  public settings: InputSignal<GraphLayoutSettings> = input({
    ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
    padding: { ...DEFAULT_GRAPH_LAYOUT_SETTINGS.padding },
  });

  constructor() {
    effect((): void => {
      this.applyHoverHighlight(this.workspace.selectedDerivedNodeId());
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (!this.rootGroupSelection) return;

    if (
      changes['graphData'] ||
      changes['superTypeColors'] ||
      changes['fallbackColor'] ||
      changes['settings']
    ) {
      this.render(this.graphData());
      this.applyHoverHighlight(this.workspace.selectedDerivedNodeId());
    }
  }

  public ngAfterViewInit(): void {
    this.mountSvg();
    this.render(this.graphData());
    this.destroyRef.onDestroy((): void => this.cleanup());
  }

  private mountSvg(): void {
    if (this.svgSelection) return;
    const hostElement: HTMLDivElement = this.getHostElement();

    this.svgSelection = d3
      .select(hostElement)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('user-select', 'none');
    this.rootGroupSelection = this.svgSelection.append('g');

    this.zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>): void => {
        this.rootGroupSelection?.attr('transform', event.transform.toString());
      });
    this.svgSelection.call(this.zoomBehavior);

    this.resizeObserver = new ResizeObserver((): void => {
      this.updateViewBox();
      this.render(this.graphData());
    });
    this.resizeObserver.observe(hostElement);

    this.updateViewBox();
  }

  private render(data: GraphData): void {
    if (!this.rootGroupSelection) return;
    const viewport: ViewportSize = getViewportSize(this.getHostElement());

    const model: RenderModel = buildRenderModel({
      data,
      settings: this.settings(),
      viewport,
    });
    this.renderModel = model;

    this.linkSelection = this.drawLinks(this.rootGroupSelection, model.links);
    this.nodeSelection = this.drawNodes(this.rootGroupSelection, model.nodes);

    this.updateLinkPositions();
    this.updateNodePositions();

    window.requestAnimationFrame((): void => {
      window.requestAnimationFrame((): void => {
        this.fitToLayout();
      });
    });
  }

  private drawLinks(
    rootGroupSelection: d3.Selection<SVGGElement, unknown, null, undefined>,
    links: ResolvedLink[],
  ): d3.Selection<SVGLineElement, ResolvedLink, SVGGElement, unknown> {
    const selection: Selection<SVGLineElement, ResolvedLink, SVGGElement, unknown> =
      rootGroupSelection
        .selectAll<SVGLineElement, ResolvedLink>('line.link')
        .data(links, (link: ResolvedLink): string => link.id);
    selection.exit().remove();

    return selection.enter().append('line').attr('class', 'link').merge(selection);
  }

  private drawNodes(
    rootGroupSelection: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodes: PositionedNode[],
  ): d3.Selection<SVGGElement, PositionedNode, SVGGElement, unknown> {
    const selection: Selection<SVGGElement, PositionedNode, SVGGElement, unknown> =
      rootGroupSelection
        .selectAll<SVGGElement, PositionedNode>('g.node')
        .data(nodes, (node: PositionedNode): string => node.id);
    selection.exit().remove();

    const enterSelection: Selection<SVGGElement, PositionedNode, SVGGElement, unknown> = selection
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(this.createDragBehavior())
      .on('mouseenter', this.handleNodeHover.bind(this))
      .on('mouseleave', this.handleNodeLeave.bind(this))
      .on('click', this.handleNodeClick.bind(this));

    enterSelection
      .append('circle')
      .attr('r', DEFAULT_GRAPH_LAYOUT_SETTINGS.nodeRadius)
      .style('--g-node-fill', (node: PositionedNode): string => this.getNodeColor(node));

    enterSelection
      .append('text')
      .attr('dx', 0)
      .attr('dy', 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('pointer-events', 'none')
      .text((node: PositionedNode): string => node.label ?? node.refId ?? node.id);

    const mergedSelection: d3.Selection<SVGGElement, PositionedNode, SVGGElement, unknown> =
      enterSelection.merge(selection);
    mergedSelection
      .select('circle')
      .style('--g-node-fill', (node: PositionedNode) => this.getNodeColor(node));

    return mergedSelection;
  }

  private getNodeColor(node: GraphNode): string {
    const superType: string = node.superType;
    return this.superTypeColors()[superType] ?? this.fallbackColor();
  }

  private updateLinkPositions(): void {
    this.linkSelection
      ?.attr('x1', (link: ResolvedLink): number => link.source.x)
      ?.attr('y1', (link: ResolvedLink): number => link.source.y)
      ?.attr('x2', (link: ResolvedLink): number => link.target.x)
      ?.attr('y2', (link: ResolvedLink): number => link.target.y);
  }

  private updateNodePositions(): void {
    this.nodeSelection?.attr(
      'transform',
      (node: PositionedNode): string => `translate(${node.x}, ${node.y})`,
    );
  }

  private createDragBehavior(): d3.DragBehavior<SVGGElement, PositionedNode, unknown> {
    return d3
      .drag<SVGGElement, PositionedNode>()
      .on(
        'start',
        (_event: d3.D3DragEvent<SVGGElement, PositionedNode, unknown>, node: PositionedNode) => {
          node.wobbleUntil = undefined;
        },
      )
      .on(
        'drag',
        (event: d3.D3DragEvent<SVGGElement, PositionedNode, unknown>, node: PositionedNode) => {
          node.x = event.x;
          node.y = event.y;
          node.baseX = event.x;
          node.baseY = event.y;
          this.updateLinkPositions();
          this.updateNodePositions();
        },
      )
      .on(
        'end',
        (_event: d3.D3DragEvent<SVGGElement, PositionedNode, unknown>, node: PositionedNode) => {
          node.baseX = node.x;
          node.baseY = node.y;
        },
      );
  }

  private applyHoverHighlight(nodeId: string): void {
    const model: RenderModel | undefined = this.renderModel;
    if (!model) return;

    if (nodeId === '') return;
    const relatedNodeIds: Set<string> = new Set<string>([nodeId]);
    const relatedLinkIds: Set<string> = new Set<string>();

    for (const link of model.links) {
      if (link.source.id === nodeId || link.target.id === nodeId) {
        relatedNodeIds.add(link.source.id);
        relatedNodeIds.add(link.target.id);
        relatedLinkIds.add(link.id);
      }
    }

    this.nodeSelection
      ?.classed('is-dimmed', (candidate: PositionedNode) => !relatedNodeIds.has(candidate.id))
      .classed('is-highlighted', (candidate: PositionedNode) => relatedNodeIds.has(candidate.id));

    this.linkSelection
      ?.classed('is-dimmed', (candidate: ResolvedLink) => !relatedLinkIds.has(candidate.id))
      .classed('is-highlighted', (candidate: ResolvedLink) => relatedLinkIds.has(candidate.id));
  }

  private clearHoverHighlight(): void {
    this.nodeSelection?.classed('is-dimmed', false).classed('is-highlighted', false);
    this.linkSelection?.classed('is-dimmed', false).classed('is-highlighted', false);
  }

  private fitToLayout(): void {
    if (!this.svgSelection || !this.zoomBehavior || !this.rootGroupSelection) return;

    const rootGroupElement: SVGGElement | null = this.rootGroupSelection.node();
    if (!rootGroupElement) return;

    const viewport: ViewportSize = getViewportSize(this.getHostElement());
    const padding: GraphPadding = this.settings().padding;

    const contentBox: DOMRect = rootGroupElement.getBBox();
    if (contentBox.width <= 0 || contentBox.height <= 0) return;

    const availableWidth: number = Math.max(1, viewport.width - padding.left - padding.right);
    const availableHeight: number = Math.max(1, viewport.height - padding.top - padding.bottom);

    const rawScale: number = Math.min(
      availableWidth / contentBox.width,
      availableHeight / contentBox.height,
    );
    const clampedScale: number = Math.max(0.2, Math.min(4, rawScale));

    const translateX: number =
      padding.left +
      (availableWidth - contentBox.width * clampedScale) / 2 -
      contentBox.x * clampedScale;

    const translateY: number =
      padding.top +
      (availableHeight - contentBox.height * clampedScale) / 2 -
      contentBox.y * clampedScale;

    const transform: d3.ZoomTransform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(clampedScale);

    this.svgSelection.call(this.zoomBehavior.transform, transform);
  }

  private updateViewBox(): void {
    if (!this.svgSelection) return;
    const viewport: ViewportSize = getViewportSize(this.getHostElement());
    this.svgSelection.attr('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
  }

  private getHostElement(): HTMLDivElement {
    const element: HTMLDivElement | undefined = this.host()?.nativeElement;
    if (!element) throw new Error('Cannot render graph without host element.');
    return element;
  }

  private cleanup(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;

    this.svgSelection?.remove();
    this.svgSelection = undefined;
    this.rootGroupSelection = undefined;
    this.zoomBehavior = undefined;

    this.nodeSelection = undefined;
    this.linkSelection = undefined;

    this.renderModel = undefined;
  }

  protected handleNodeHover(_: MouseEvent, node: PositionedNode): void {
    this.applyHoverHighlight(node.id);
  }

  protected handleNodeLeave(): void {
    this.clearHoverHighlight();
    if (!this.settings().isSelectedNodeHighlighted) return;
    this.applyHoverHighlight(this.workspace.selectedDerivedNodeId());
  }

  protected handleNodeClick(_: MouseEvent, node: PositionedNode): void {
    this.workspace.setDerivedNodeId(node.id);
    void this.router.navigate([node.id], { relativeTo: this.activatedRoute });
  }
}
