import {
  AfterViewInit,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  InputSignal,
  signal,
  Signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import * as d3 from 'd3';
import { ZoomTransform } from 'd3';
import { GraphData } from '../../../../../core/GModelGraph';
import type {
  LinkSelection,
  NodeDrag,
  NodeSelection,
  RootSelection,
  SVGSelection,
  ZoomBehaviour,
  ZoomEvent,
} from './graph.types';
import {
  DEFAULT_GRAPH_LAYOUT_SETTINGS,
  GraphLayoutSettings,
  GraphPadding,
  PositionedNode,
  RenderModel,
  ResolvedLink,
  ViewportSize,
} from './graph.types';
import { buildRenderModel, getViewportSize } from './graph.layout';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { NodeColors } from '../../../../../models/ModelRecord';

@Component({
  selector: 'app-graph',
  imports: [],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.scss',
})
export class GraphComponent implements AfterViewInit {
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly destroyRef: DestroyRef = inject(DestroyRef);

  protected svgSelection?: SVGSelection;
  protected rootGroupSelection?: RootSelection;
  protected zoomBehavior?: ZoomBehaviour;

  protected nodeSelection?: NodeSelection;
  protected linkSelection?: LinkSelection;

  protected renderModel?: RenderModel;
  protected resizeObserver?: ResizeObserver;
  protected isResizeRenderPending: boolean = false;

  protected readonly host: Signal<ElementRef<HTMLDivElement> | undefined> = viewChild('host');
  protected readonly superTypeColors: WritableSignal<NodeColors> = signal({});

  public graphData: InputSignal<GraphData> = input({ nodes: [], links: [] } as GraphData);
  public settings: InputSignal<GraphLayoutSettings> = input({
    ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
    padding: { ...DEFAULT_GRAPH_LAYOUT_SETTINGS.padding },
  });

  private lastGraphDataRef?: GraphData;
  private lastSettingsRef?: GraphLayoutSettings;
  private currentTransform: ZoomTransform = d3.zoomIdentity;

  constructor() {
    this.registerHoverEffect();
    this.registerColorChangesEffect();
    this.registerGraphChangesEffect();
  }

  private registerHoverEffect(): void {
    effect((): void => this.refreshHover());
  }

  private registerColorChangesEffect(): void {
    effect((): void => {
      this.superTypeColors.set(this.workspace.store.selectedNodeColors());
      untracked((): void => this.updateNodeColorsOnly());
    });
  }

  private registerGraphChangesEffect(): void {
    effect((): void => {
      const data: GraphData = this.graphData();
      const settings: GraphLayoutSettings = this.settings();

      if (!this.rootGroupSelection) return;

      const hasGraphChanged: boolean = this.lastGraphDataRef !== data;
      const haveSettingsChanged: boolean = this.lastSettingsRef !== settings;
      if (!hasGraphChanged && !haveSettingsChanged) return;

      this.lastGraphDataRef = data;
      this.lastSettingsRef = settings;

      if (hasGraphChanged) {
        this.svgSelection?.interrupt();
        this.svgSelection?.call(this.zoomBehavior!.transform, d3.zoomIdentity);
      }

      this.render(data, true);
      this.refreshHover();
    });
  }

  public ngAfterViewInit(): void {
    this.mountSvg();
    this.render(this.graphData(), true);
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
    this.drawArrowMarker();

    this.zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event: ZoomEvent): void => {
        this.currentTransform = event.transform;
        this.rootGroupSelection?.attr('transform', event.transform.toString());
      });

    this.svgSelection.call(this.zoomBehavior);

    this.resizeObserver = new ResizeObserver((): void => {
      if (this.isResizeRenderPending) return;
      this.isResizeRenderPending = true;

      window.requestAnimationFrame((): void => {
        this.isResizeRenderPending = false;
        this.updateViewBox();
        this.render(this.graphData(), false);
      });
    });

    this.resizeObserver.observe(hostElement);
    this.updateViewBox();
  }

  private render(data: GraphData, shouldFit: boolean): void {
    if (!this.rootGroupSelection) return;

    const viewport: ViewportSize = getViewportSize(this.getHostElement());
    const model: RenderModel = buildRenderModel({ data, settings: this.settings(), viewport });
    this.renderModel = model;

    this.linkSelection = this.drawLinks(this.rootGroupSelection, model.links);
    this.nodeSelection = this.drawNodes(this.rootGroupSelection, model.nodes);

    this.updateLinkPositions();
    this.updateNodePositions();
    this.updateNodeColorsOnly();

    this.rootGroupSelection.attr('transform', this.currentTransform.toString());
    if (!shouldFit) return;

    window.requestAnimationFrame((): void => {
      window.requestAnimationFrame((): void => {
        this.fitToLayoutAnimated(180);
      });
    });
  }

  private updateNodeColorsOnly(): void {
    this.nodeSelection
      ?.select('circle')
      .style('--g-node-fill', (node: PositionedNode): string => this.getNodeColor(node));
  }

  private refreshHover(): void {
    const selectedId: string | null = this.workspace.store.selectedNodeId();
    this.clearHoverHighlight();
    this.applyHoverHighlight(selectedId);
    this.applySelectedHighlight(selectedId);
  }

  private drawLinks(rootGroupSelection: RootSelection, links: ResolvedLink[]): LinkSelection {
    return rootGroupSelection
      .selectAll<SVGLineElement, ResolvedLink>('line.link')
      .data(links, (link: ResolvedLink): string => link.id)
      .join(
        (enter) => enter.append('line').attr('class', 'link').attr('marker-end', 'url(#g-arrow)'),
        (update) => update,
        (exit) => exit.remove(),
      );
  }

  private drawNodes(rootGroupSelection: RootSelection, nodes: PositionedNode[]): NodeSelection {
    const merged: NodeSelection = rootGroupSelection
      .selectAll<SVGGElement, PositionedNode>('g.node')
      .data(nodes, (node: PositionedNode): string => node.id)
      .join(
        (enter) => {
          const g = enter
            .append('g')
            .attr('class', 'node')
            .call(this.createDragBehavior())
            .on('mouseenter', this.handleNodeHover.bind(this))
            .on('mouseleave', this.handleNodeLeave.bind(this))
            .on('click', this.handleNodeClick.bind(this));

          g.append('circle');

          g.append('text')
            .attr('dx', 0)
            .attr('dy', 35)
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .attr('pointer-events', 'none');

          return g;
        },
        (update) => update,
        (exit) => exit.remove(),
      );

    merged.select('circle').attr('r', this.settings().nodeRadius);
    merged.select('text').text((node: PositionedNode): string => node.label ?? node.id);

    return merged;
  }

  private drawArrowMarker(): void {
    if (!this.svgSelection) return;

    const defs = this.svgSelection.selectAll<SVGDefsElement, unknown>('defs').data([0]).join('defs');

    const marker = defs
      .selectAll<SVGMarkerElement, unknown>('marker#g-arrow')
      .data([0])
      .join('marker')
      .attr('id', 'g-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 8)
      .attr('refY', 5)
      .attr('markerUnits', 'userSpaceOnUse')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('orient', 'auto');

    marker
      .selectAll<SVGPathElement, unknown>('path')
      .data([0])
      .join('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', 'var(--g-link-stroke)');
  }

  private getNodeColor(node: PositionedNode): string {
    return this.superTypeColors()[node.superType] ?? 'currentColor';
  }

  private getHostElement(): HTMLDivElement {
    const element: HTMLDivElement | undefined = this.host()?.nativeElement;
    if (!element) throw new Error('Cannot render graph without host element.');
    return element;
  }

  private updateViewBox(): void {
    if (!this.svgSelection) return;
    const viewport: ViewportSize = getViewportSize(this.getHostElement());
    this.svgSelection.attr('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
  }

  private computeTrimmedEnds(
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    sourceTrimPixels: number,
    targetTrimPixels: number,
  ): { x1: number; y1: number; x2: number; y2: number } {
    const deltaX: number = targetX - sourceX;
    const deltaY: number = targetY - sourceY;
    const length: number = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (!Number.isFinite(length) || length <= 0.0001) {
      return { x1: sourceX, y1: sourceY, x2: targetX, y2: targetY };
    }

    const unitX: number = deltaX / length;
    const unitY: number = deltaY / length;

    return {
      x1: sourceX + unitX * sourceTrimPixels,
      y1: sourceY + unitY * sourceTrimPixels,
      x2: targetX - unitX * targetTrimPixels,
      y2: targetY - unitY * targetTrimPixels,
    };
  }

  private updateLinkPositions(): void {
    const nodeRadius: number = this.settings().nodeRadius;
    const arrowTrimPixels: number = 5;

    const computeTrimmedEnds = this.computeTrimmedEnds.bind(this);

    this.linkSelection?.each(function (this: SVGLineElement, link: ResolvedLink): void {
      const trimmed = computeTrimmedEnds(
        link.source.x,
        link.source.y,
        link.target.x,
        link.target.y,
        nodeRadius + 1,
        nodeRadius + arrowTrimPixels,
      );

      d3.select<SVGLineElement, ResolvedLink>(this)
        .attr('x1', trimmed.x1)
        .attr('y1', trimmed.y1)
        .attr('x2', trimmed.x2)
        .attr('y2', trimmed.y2);
    });
  }

  private updateNodePositions(): void {
    this.nodeSelection?.attr('transform', (node: PositionedNode): string => `translate(${node.x}, ${node.y})`);
  }

  private createDragBehavior(): NodeDrag {
    return d3
      .drag<SVGGElement, PositionedNode>()
      .on('drag', (event: d3.D3DragEvent<SVGGElement, PositionedNode, unknown>, node: PositionedNode) => {
        node.x = event.x;
        node.y = event.y;
        node.baseX = event.x;
        node.baseY = event.y;
        this.updateLinkPositions();
        this.updateNodePositions();
      })
      .on('end', (_event: d3.D3DragEvent<SVGGElement, PositionedNode, unknown>, node: PositionedNode) => {
        node.baseX = node.x;
        node.baseY = node.y;
      });
  }

  private applySelectedHighlight(nodeId: string | null): void {
    this.nodeSelection?.classed('is-selected', (node: PositionedNode): boolean => node.id === nodeId);
  }

  private applyHoverHighlight(nodeId: string | null): void {
    const model: RenderModel | undefined = this.renderModel;
    if (!model || !nodeId) return;
    if (!model.nodesById.has(nodeId)) return;

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

  private fitToLayoutAnimated(durationMilliseconds: number = 180): void {
    if (!this.svgSelection || !this.zoomBehavior || !this.rootGroupSelection) return;

    const rootGroupElement: SVGGElement | null = this.rootGroupSelection.node();
    if (!rootGroupElement) return;

    const viewport: ViewportSize = getViewportSize(this.getHostElement());
    const padding: GraphPadding = this.settings().padding;

    const contentBox: DOMRect = rootGroupElement.getBBox();
    if (contentBox.width <= 0 || contentBox.height <= 0) return;

    const availableWidth: number = Math.max(1, viewport.width - padding.left - padding.right);
    const availableHeight: number = Math.max(1, viewport.height - padding.top - padding.bottom);

    const rawScale: number = Math.min(availableWidth / contentBox.width, availableHeight / contentBox.height);
    const clampedScale: number = Math.max(0.2, Math.min(4, rawScale));

    const translateX: number =
      padding.left + (availableWidth - contentBox.width * clampedScale) / 2 - contentBox.x * clampedScale;

    const translateY: number =
      padding.top + (availableHeight - contentBox.height * clampedScale) / 2 - contentBox.y * clampedScale;

    const targetTransform: d3.ZoomTransform = d3.zoomIdentity.translate(translateX, translateY).scale(clampedScale);

    this.svgSelection
      .transition()
      .duration(durationMilliseconds)
      .ease(d3.easeCubicInOut)
      .call(this.zoomBehavior.transform, targetTransform);
  }

  private cleanup(): void {
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
    this.refreshHover();
  }

  protected handleNodeClick(_: MouseEvent, node: PositionedNode): void {
    this.workspace.store.setSelectedNodeId(node.id);
  }
}
