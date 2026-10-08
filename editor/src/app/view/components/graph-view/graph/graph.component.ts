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
  ChangeDetectionStrategy,
  ViewEncapsulation,
} from '@angular/core';
import * as d3 from 'd3';
import { ZoomTransform } from 'd3';
import { GraphData } from '../../../../core/utils/ModelGraph';
import {
  type LinkSelection,
  type NodeDrag,
  type NodeSelection,
  type RootSelection,
  type SVGSelection,
  type ZoomBehaviour,
  type ZoomEvent,
  DEFAULT_GRAPH_LAYOUT_SETTINGS,
  GraphLayoutSettings,
  GraphPadding,
  PositionedNode,
  RenderModel,
  ResolvedLink,
  ViewportSize,
} from './graph.types';

import { buildRenderModel, getViewportSize } from './graph.layout';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { ModelRef } from '@ramen-suite/core/model';
import { StorageService } from '../../../../services/storage.service';
import { type ModelRecord, NodeColors } from '../../../../models/ModelRecord';

import { NavigationService } from '../../../../services/navigation.service';

interface LineEnds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-graph',
  encapsulation: ViewEncapsulation.None,
  imports: [],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.scss',
})
export class GraphComponent implements AfterViewInit {
  private readonly storage: StorageService = inject(StorageService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly destroyRef: DestroyRef = inject(DestroyRef);

  protected readonly navigation: NavigationService = inject(NavigationService);

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

  public readonly graphData: InputSignal<GraphData> = input({ nodes: [], links: [] } as GraphData);
  public readonly settings: InputSignal<GraphLayoutSettings> = input({
    ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
    padding: { ...DEFAULT_GRAPH_LAYOUT_SETTINGS.padding },
  });

  private readonly frames: Set<number> = new Set();
  private lastGraphDataRef?: GraphData;
  private lastSettingsRef?: GraphLayoutSettings;
  private currentTransform: ZoomTransform = d3.zoomIdentity;

  public constructor() {
    this.registerHoverEffect();
    this.registerColorChangesEffect();
    this.registerGraphChangesEffect();
  }

  private registerHoverEffect(): void {
    effect((): void => this.refreshHover());
  }

  private registerColorChangesEffect(): void {
    effect((): void => {
      this.superTypeColors.set(this.workspace.store.currentNodeColors());
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
        if (this.zoomBehavior) this.svgSelection?.call(this.zoomBehavior.transform, d3.zoomIdentity);
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
      .style('user-select', 'none')
      .on('click', (event: MouseEvent): void => this.handleBackgroundClick(event));

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

      this.scheduleFrame((): void => {
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

    this.scheduleFrame((): void => {
      this.scheduleFrame((): void => {
        this.fitToLayoutAnimated(180);
      });
    });
  }

  private updateNodeColorsOnly(): void {
    this.nodeSelection
      ?.select('rect')
      .style('--g-node-fill', (node: PositionedNode): string => this.getNodeColor(this.resolveNodeForColor(node)));
  }

  private resolveNodeForColor(node: PositionedNode): PositionedNode {
    const model: RenderModel | undefined = this.renderModel;
    if (!model) return node;
    const realId: string | undefined = node.ghost?.realNodeId;
    if (!realId) return node;
    return model.nodesById.get(realId) ?? node;
  }

  private refreshHover(): void {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    this.clearHoverHighlight();
    this.applyHoverHighlight(selectedId);
    this.applySelectedHighlight(selectedId);
  }

  private drawLinks(rootGroupSelection: RootSelection, links: ResolvedLink[]): LinkSelection {
    const merged: LinkSelection = rootGroupSelection
      .selectAll<SVGLineElement, ResolvedLink>('line.link')
      .data(links, (link: ResolvedLink): string => link.id)
      .join(
        (enter) => enter.append('line').attr('class', 'link').attr('marker-end', 'url(#g-arrow)'),
        (update) => update,
        (exit) => exit.remove(),
      );

    rootGroupSelection
      .selectAll<SVGTextElement, ResolvedLink>('text.link-label')
      .data(links, (link: ResolvedLink): string => link.id)
      .join('text')
      .attr('class', 'link-label')
      .text((link: ResolvedLink): string => link.label);
    merged.classed('is-ghost', (link: ResolvedLink): boolean => link.meta?.kind === 'ghost-self');
    return merged;
  }

  private drawNodes(rootGroupSelection: RootSelection, nodes: PositionedNode[]): NodeSelection {
    const merged: NodeSelection = rootGroupSelection
      .selectAll<SVGGElement, PositionedNode>('g.node')
      .data(nodes, (node: PositionedNode): string => node.id)
      .join(
        (enter) => {
          const g: NodeSelection = enter
            .append('g')
            .attr('class', 'node')
            .call(this.createDragBehavior())
            .on('mouseenter', this.handleNodeHover.bind(this))
            .on('mouseleave', this.handleNodeLeave.bind(this))
            .on('click', this.handleNodeClick.bind(this));

          g.append('rect').attr('x', -80).attr('y', -32).attr('width', 160).attr('height', 64).attr('rx', 10);
          g.append('title');
          g.append('text').attr('class', 'node-base').attr('dy', 17).attr('text-anchor', 'middle');

          g.append('text')
            .attr('dx', 0)
            .attr('dy', -4)
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .attr('pointer-events', 'none');

          return g;
        },
        (update) => update,
        (exit) => exit.remove(),
      );

    this.updateNodeLabels(merged);

    return merged;
  }

  private updateNodeLabels(merged: NodeSelection): void {
    merged
      .select('text:not(.node-base)')
      .text((node: PositionedNode): string => (node.label.length > 20 ? `${node.label.slice(0, 19)}…` : node.label));
    merged
      .select('text.node-base')
      .text((node: PositionedNode): string => (node.baseName ? `refines ${node.baseName.slice(0, 19)}` : 'Base definition'));
    merged
      .select('title')
      .text(
        (node: PositionedNode): string =>
          `${node.label} · ${node.modelName}${node.baseName ? ` · refines ${node.baseName}` : ''}`,
      );
    merged.classed('is-ghost', (node: PositionedNode): boolean => !!node.ghost);
  }

  private drawArrowMarker(): void {
    if (!this.svgSelection) return;

    const defs: d3.Selection<SVGDefsElement, number, SVGSVGElement, unknown> = this.svgSelection
      .selectAll<SVGDefsElement, unknown>('defs')
      .data([0])
      .join('defs');

    const marker: d3.Selection<SVGMarkerElement, number, SVGDefsElement, number> = defs
      .selectAll<SVGMarkerElement, unknown>('marker#g-arrow')
      .data([0])
      .join('marker')
      .attr('id', 'g-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 5.5)
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
      .attr('fill', 'var(--color-base-content)');
  }

  private getNodeColor(node: PositionedNode): string {
    return this.superTypeColors()[node.superType] ?? 'var(--color-base-300)';
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

  private computeTrimmedEnds(sourceX: number, sourceY: number, targetX: number, targetY: number): LineEnds {
    const dx: number = targetX - sourceX;
    const dy: number = targetY - sourceY;
    const length: number = Math.hypot(dx, dy);
    if (length < 0.001) return { x1: sourceX, y1: sourceY, x2: targetX, y2: targetY };

    const ux: number = dx / length;
    const uy: number = dy / length;
    const edge: number = Math.min(80 / Math.abs(ux), 32 / Math.abs(uy));
    return { x1: sourceX + ux * edge, y1: sourceY + uy * edge, x2: targetX - ux * (edge + 5), y2: targetY - uy * (edge + 5) };
  }

  private updateLinkPositions(): void {
    const trim: (sx: number, sy: number, tx: number, ty: number) => LineEnds = this.computeTrimmedEnds.bind(this);
    this.linkSelection?.each(function (this: SVGLineElement, link: ResolvedLink): void {
      const ends: LineEnds = trim(link.source.x, link.source.y, link.target.x, link.target.y);
      d3.select(this).attr('x1', ends.x1).attr('y1', ends.y1).attr('x2', ends.x2).attr('y2', ends.y2);
    });
    this.rootGroupSelection
      ?.selectAll<SVGTextElement, ResolvedLink>('text.link-label')
      .attr('x', (link: ResolvedLink): number => (link.source.x + link.target.x) / 2 + 8)
      .attr('y', (link: ResolvedLink): number => (link.source.y + link.target.y) / 2);
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
    this.nodeSelection?.classed('is-selected', (node: PositionedNode): boolean => {
      const resolvedId: string = node.ghost?.realNodeId ?? node.id;
      return resolvedId === nodeId;
    });
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

    const isNodeRelated: (candidate: PositionedNode) => boolean = (candidate: PositionedNode): boolean => {
      const realId: string | undefined = candidate.ghost?.realNodeId;
      if (!realId) return relatedNodeIds.has(candidate.id);
      if (realId === nodeId) return true;
      return relatedNodeIds.has(candidate.id);
    };

    this.nodeSelection
      ?.classed('is-dimmed', (candidate: PositionedNode): boolean => !isNodeRelated(candidate))
      .classed('is-highlighted', (candidate: PositionedNode): boolean => isNodeRelated(candidate));

    this.linkSelection
      ?.classed('is-dimmed', (candidate: ResolvedLink): boolean => !relatedLinkIds.has(candidate.id))
      .classed('is-highlighted', (candidate: ResolvedLink): boolean => relatedLinkIds.has(candidate.id));
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
    const clampedScale: number = Math.max(0.2, Math.min(1, rawScale));

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

  private scheduleFrame(action: () => void): void {
    const id: number = window.requestAnimationFrame((): void => {
      this.frames.delete(id);
      if (!this.destroyRef.destroyed) action();
    });
    this.frames.add(id);
  }

  private cleanup(): void {
    for (const id of this.frames) window.cancelAnimationFrame(id);
    this.frames.clear();
    this.svgSelection?.interrupt();
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
    const realId: string = node.ghost?.realNodeId ?? node.id;
    this.applyHoverHighlight(realId);
  }

  protected handleNodeLeave(): void {
    this.refreshHover();
  }

  protected handleNodeClick(event: MouseEvent, node: PositionedNode): void {
    event.stopPropagation();
    const selectedSlot: number = this.workspace.store.currentSlot();
    const resolvedId: string = node.ghost?.realNodeId ?? node.id;
    if (ModelRef.isQualified(resolvedId)) {
      const { modelId, refId } = ModelRef.splitQualified(resolvedId);
      const record: ModelRecord | undefined = this.storage
        .records()
        .find((item: ModelRecord): boolean => item.gmodel.id === modelId);
      if (record) void this.navigation.navigateToNode(record.slot, refId);
      return;
    }
    void this.navigation.navigateToNode(selectedSlot, resolvedId);
  }

  private handleBackgroundClick(event: MouseEvent): void {
    const target: EventTarget | null = event.target;
    if (!(target instanceof Element)) return;

    const isOnNode: boolean = !!target.closest('g.node');
    const isOnLink: boolean = !!target.closest('line.link');
    if (isOnNode || isOnLink) return;

    const selectedSlot: number = this.workspace.store.currentSlot();
    void this.navigation.navigateToSlot(selectedSlot);
  }
}
