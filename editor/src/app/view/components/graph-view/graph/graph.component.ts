import {
  AfterViewInit,
  Component,
  output,
  type OutputEmitterRef,
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
import { ApplicationState } from '../../../../states/application.state';
import { TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

import { buildRenderModel, getViewportSize, setNodePosition } from './graph.layout';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { getLinkPath } from './graph.geometry';
import { positionLinkLabels } from './graph.labels';
import { ModelRef } from '@ramen-suite/core/model';
import { StorageService } from '../../../../services/storage.service';
import { type ModelRecord, type GraphView, NodeColors } from '../../../../models/ModelRecord';

import { NavigationService } from '../../../../services/navigation.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-graph',
  encapsulation: ViewEncapsulation.None,
  imports: [],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.scss',
})
export class GraphComponent implements AfterViewInit {
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly translations: TranslocoService = inject(TranslocoService);
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
  private recordId: string | null = null;
  private currentTransform: ZoomTransform = d3.zoomIdentity;

  public readonly nodeSelected: OutputEmitterRef<void> = output();

  public constructor() {
    this.translations.langChanges$.pipe(takeUntilDestroyed()).subscribe((): void => {
      if (this.nodeSelection) this.updateNodeLabels(this.nodeSelection);
    });
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
      const recordId: string | null = this.workspace.store.currentModelRecord()?.modelId ?? null;

      if (!this.rootGroupSelection) return;

      const hasGraphChanged: boolean = this.lastGraphDataRef !== data;
      const haveSettingsChanged: boolean = this.lastSettingsRef !== settings;
      if (!hasGraphChanged && !haveSettingsChanged && this.recordId === recordId) return;

      this.lastGraphDataRef = data;
      this.lastSettingsRef = settings;

      this.render(data);
      this.refreshHover();
    });
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
      })
      .on('end', (event: ZoomEvent): void => {
        if (event.sourceEvent) this.saveView();
      });

    this.svgSelection.call(this.zoomBehavior);

    this.resizeObserver = new ResizeObserver((): void => {
      if (this.isResizeRenderPending) return;
      this.isResizeRenderPending = true;

      this.scheduleFrame((): void => {
        this.isResizeRenderPending = false;
        this.updateViewBox();
      });
    });

    this.resizeObserver.observe(hostElement);
    this.updateViewBox();
  }

  private render(data: GraphData, reset: boolean = false): void {
    if (!this.rootGroupSelection) return;
    const record: ModelRecord | null = untracked((): ModelRecord | null => this.workspace.store.currentModelRecord());
    const recordId: string | null = record?.modelId ?? null;
    const changedLevel: boolean = this.recordId !== recordId;
    const saved: GraphView | undefined = changedLevel ? record?.view?.graph : undefined;
    const previous: RenderModel | undefined = changedLevel || reset ? undefined : this.renderModel;
    const viewport: ViewportSize = getViewportSize(this.getHostElement());
    const model: RenderModel = buildRenderModel({ data, settings: this.settings(), viewport });
    this.restorePositions(model, previous, saved);
    this.recordId = recordId;
    this.renderModel = model;
    this.linkSelection = this.drawLinks(this.rootGroupSelection, model.links);
    this.nodeSelection = this.drawNodes(this.rootGroupSelection, model.nodes);
    this.updateLinkPositions();
    this.updateNodePositions();
    this.updateNodeColorsOnly();
    this.refreshHover();

    this.restoreViewport(saved, !previous?.nodes.length);
    if (record) this.saveView();
  }

  private restorePositions(model: RenderModel, previous: RenderModel | undefined, saved: GraphView | undefined): void {
    for (const node of model.nodes) {
      const position: { x: number; y: number } | undefined = previous?.nodesById.get(node.id) ?? saved?.positions[node.id];
      if (position) setNodePosition(node, position.x, position.y);
    }
  }

  private restoreViewport(saved: GraphView | undefined, fit: boolean): void {
    if (saved) {
      this.applyViewTransform(d3.zoomIdentity.translate(saved.viewport.x, saved.viewport.y).scale(saved.viewport.scale), 0);
    } else if (fit) {
      this.fitToLayoutAnimated(0);
    }
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
      viewport: { x: this.currentTransform.x, y: this.currentTransform.y, scale: this.currentTransform.k },
    };
    void this.workspace.actions
      .updateGraphView(this.recordId, graph)
      .catch((error: unknown): void => this.storage.reportError(error));
  }

  private updateNodeColorsOnly(): void {
    this.nodeSelection?.select('rect').style('--g-node-fill', (node: PositionedNode): string => this.getNodeColor(node));
  }

  private refreshHover(): void {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    this.clearHoverHighlight();
    this.applyHoverHighlight(selectedId);
    this.applySelectedHighlight(selectedId);
  }

  private drawLinks(rootGroupSelection: RootSelection, links: ResolvedLink[]): LinkSelection {
    const merged: LinkSelection = rootGroupSelection
      .selectAll<SVGPathElement, ResolvedLink>('path.link')
      .data(links, (link: ResolvedLink): string => link.id)
      .join(
        (enter) =>
          enter
            .append('path')
            .attr('class', 'link')
            .attr('fill', 'none')
            .style('--graph-arrival-delay', (_link: ResolvedLink, index: number): string => `${220 + Math.min(index, 8) * 25}ms`)
            .attr('data-nori-motion', '')
            .attr('marker-end', 'url(#g-arrow)'),
        (update) => update,
        (exit) => exit.remove(),
      );

    rootGroupSelection
      .selectAll<SVGTextElement, ResolvedLink>('text.link-label')
      .data(links, (link: ResolvedLink): string => link.id)
      .join(
        (enter) =>
          enter
            .append('text')
            .attr('class', 'link-label')
            .attr('data-nori-motion', '')
            .style('--graph-arrival-delay', (_link: ResolvedLink, index: number): string => `${380 + Math.min(index, 8) * 25}ms`),
        (update) => update,
        (exit) => exit.remove(),
      )
      .text((link: ResolvedLink): string => link.label);
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
            .style(
              '--graph-arrival-delay',
              (_node: PositionedNode, index: number): string => `${100 + Math.min(index, 8) * 30}ms`,
            )
            .attr('data-nori-motion', '')
            .call(this.createDragBehavior())
            .on('mouseenter', this.handleNodeHover.bind(this))
            .on('mouseleave', this.handleNodeLeave.bind(this))
            .on('click', this.handleNodeClick.bind(this));

          const content: NodeSelection = g.append('g').attr('class', 'node-content').attr('data-nori-motion', '');
          content
            .append('rect')
            .attr('x', -80)
            .attr('y', -32)
            .attr('width', 160)
            .attr('height', 64)
            .style('rx', 'var(--nori-radius-input)');
          g.append('title');
          content.append('text').attr('class', 'node-base').attr('dy', 17).attr('text-anchor', 'middle');
          content.append('text').attr('dy', -4).attr('text-anchor', 'middle').attr('font-size', 16);

          return g;
        },
        (update) => update,
        (exit) => exit.remove(),
      );

    merged.attr('role', 'button').attr('tabindex', 0).on('keydown', this.handleNodeKeyDown.bind(this));
    this.updateNodeLabels(merged);

    return merged;
  }

  private updateNodeLabels(merged: NodeSelection): void {
    merged
      .select('text:not(.node-base)')
      .text((node: PositionedNode): string => (node.label.length > 20 ? `${node.label.slice(0, 19)}…` : node.label));
    merged
      .select('text.node-base')
      .text((node: PositionedNode): string =>
        node.baseName
          ? this.translations.translate('editor.refines', { name: node.baseName.slice(0, 19) })
          : this.translations.translate('editor.baseNode'),
      );
    merged
      .select('title')
      .text(
        (node: PositionedNode): string =>
          `${node.label} · ${node.modelName}${node.baseName ? ` · ${this.translations.translate('editor.refines', { name: node.baseName })}` : ''}`,
      );
    merged.attr('aria-label', (node: PositionedNode): string => `${node.label}, ${node.baseName || node.modelName}`);
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

  private updateLinkPositions(): void {
    if (!this.linkSelection || !this.rootGroupSelection || !this.renderModel) return;
    const nodes: PositionedNode[] = this.renderModel.nodes;
    this.linkSelection.attr('d', (link: ResolvedLink): string => getLinkPath(link, nodes));
    positionLinkLabels(this.rootGroupSelection, this.linkSelection, nodes);
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
        this.saveView();
      });
  }

  private applySelectedHighlight(nodeId: string | null): void {
    this.nodeSelection?.classed('is-selected', (node: PositionedNode): boolean => {
      const resolvedId: string = node.id;
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

    const isNodeRelated: (candidate: PositionedNode) => boolean = (candidate: PositionedNode): boolean =>
      relatedNodeIds.has(candidate.id);

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

  public fitView(): void {
    this.fitToLayoutAnimated(this.appearance.state().animations ? 400 : 0);
    if (!this.appearance.state().animations) this.saveView();
  }

  public resetView(): void {
    this.render(this.graphData(), true);
  }

  private fitToLayoutAnimated(durationMilliseconds: number = 180): void {
    if (!this.svgSelection || !this.zoomBehavior || !this.rootGroupSelection) return;

    const rootGroupElement: SVGGElement | null = this.rootGroupSelection.node();
    if (!rootGroupElement) return;

    const viewport: ViewportSize = getViewportSize(this.getHostElement());
    const padding: GraphPadding =
      viewport.width > 720 ? this.settings().padding : { ...this.settings().padding, left: 24, right: 24 };

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

    this.applyViewTransform(targetTransform, durationMilliseconds);
  }

  private applyViewTransform(transform: ZoomTransform, duration: number): void {
    if (!this.svgSelection || !this.zoomBehavior) return;
    this.svgSelection.interrupt();
    if (duration === 0) {
      this.svgSelection.call(this.zoomBehavior.transform, transform);
      return;
    }

    this.svgSelection
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .call(this.zoomBehavior.transform, transform)
      .on('end', (): void => this.saveView());
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
    const realId: string = node.id;
    this.applyHoverHighlight(realId);
  }

  protected handleNodeLeave(): void {
    this.refreshHover();
  }

  private handleNodeKeyDown(event: KeyboardEvent, node: PositionedNode): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    this.handleNodeClick(event, node);
  }

  protected handleNodeClick(event: MouseEvent | KeyboardEvent, node: PositionedNode): void {
    event.stopPropagation();
    this.nodeSelected.emit();
    const selectedSlot: number = this.workspace.store.currentSlot();
    const resolvedId: string = node.id;
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
    const isOnLink: boolean = !!target.closest('path.link');
    if (isOnNode || isOnLink) return;

    const selectedSlot: number = this.workspace.store.currentSlot();
    void this.navigation.navigateToSlot(selectedSlot);
  }
}
