import {
  type AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ModelRef } from '@ramen-suite/core/model';
import type { ZoomTransform } from 'd3';
import * as d3 from 'd3';
import type { GraphData } from '../../../../core/utils/ModelGraph';
import { type GraphView, type ModelRecord } from '../../../../models/ModelRecord';
import { NavigationService } from '../../../../services/navigation.service';
import { StorageService } from '../../../../services/storage.service';
import { type GraphTool, GraphToolsService } from '../../../../services/workspace/graph-tools.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { ApplicationState } from '../../../../states/application.state';
import { getLinkPath } from './graph.geometry';
import { positionLinkLabels } from './graph.labels';
import { buildRenderModel, getFitViewport, getViewportSize, placeNodes, setNodePosition } from './graph.layout';
import {
  DEFAULT_GRAPH_LAYOUT_SETTINGS,
  type GraphLayoutSettings,
  type LinkSelection,
  type NodeDrag,
  type NodeSelection,
  type PositionedNode,
  type RenderModel,
  type ResolvedLink,
  type RootSelection,
  type SVGSelection,
  type ViewportSize,
  type ZoomBehaviour,
  type ZoomEvent,
} from './graph.types';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-graph',
  encapsulation: ViewEncapsulation.None,
  imports: [TranslocoDirective],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.scss',
})
export class GraphComponent implements AfterViewInit {
  protected readonly graphTools: GraphToolsService = inject(GraphToolsService);
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly storage: StorageService = inject(StorageService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly navigation: NavigationService = inject(NavigationService);

  public readonly inspectorOpen: InputSignal<boolean> = input(false);
  public readonly graphData: InputSignal<GraphData> = input<GraphData>({ nodes: [], links: [] });
  public readonly settings: InputSignal<GraphLayoutSettings> = input({
    ...DEFAULT_GRAPH_LAYOUT_SETTINGS,
    padding: { ...DEFAULT_GRAPH_LAYOUT_SETTINGS.padding },
  });
  public readonly nodeSelected: OutputEmitterRef<void> = output();

  private connectionTimer: number | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private dragMoved: boolean = false;
  private svgSelection?: SVGSelection;
  private rootGroupSelection?: RootSelection;
  private zoomBehavior?: ZoomBehaviour;
  private nodeSelection?: NodeSelection;
  private linkSelection?: LinkSelection;
  private renderModel?: RenderModel;
  private resizeObserver?: ResizeObserver;
  private isResizeRenderPending: boolean = false;
  private readonly host: Signal<ElementRef<HTMLDivElement> | undefined> = viewChild('host');
  private readonly frames: Set<number> = new Set();
  private previousGraphData?: GraphData;
  private previousSettings?: GraphLayoutSettings;
  private recordId: string | null = null;
  private currentTransform: ZoomTransform = d3.zoomIdentity;
  private inspectorRecordId: string | null = null;
  private wasInspectorOpen: boolean = false;
  private inspectorTransition: number = 0;

  public constructor() {
    this.translations.langChanges$.pipe(takeUntilDestroyed()).subscribe((): void => {
      if (this.nodeSelection) this.updateNodeLabels(this.nodeSelection);
      this.updateLinkAccessibility();
    });

    effect((): void => {
      const tool: GraphTool = this.graphTools.tool();
      this.clearConnectionTimer();
      const selected: string | null = untracked((): string | null => this.workspace.store.currentNodeId());
      if (tool === 'connect' && selected) this.graphTools.selectSource(selected);
      this.rootGroupSelection?.selectAll('.connection-preview').remove();
      this.svgSelection?.classed('is-connecting', tool === 'connect').classed('is-disconnecting', tool === 'disconnect');
      this.updateLinkAccessibility();
    });

    effect((): void => {
      if (this.graphTools.source()) return;
      this.rootGroupSelection?.selectAll('.connection-preview').remove();
      this.clearConnectionTimer();
    });

    effect((): void => this.refreshHover());
    this.registerColorChangesEffect();
    this.registerGraphChangesEffect();
  }

  public ngAfterViewInit(): void {
    this.mountSvg();
    this.render(this.graphData());
    this.syncInspectorViewport(this.inspectorOpen());
    this.destroyRef.onDestroy((): void => this.cleanup());
  }

  public fitView(): void {
    this.fitToLayoutAnimated(this.appearance.state().animations ? 400 : 0);
    if (!this.appearance.state().animations) this.saveView();
  }

  public resetView(): void {
    this.render(this.graphData(), true);
  }

  private registerColorChangesEffect(): void {
    effect((): void => {
      this.workspace.store.currentNodeColors();
      untracked((): void => this.updateNodeColorsOnly());
    });
  }

  private registerGraphChangesEffect(): void {
    effect((): void => {
      const data: GraphData = this.graphData();
      const settings: GraphLayoutSettings = this.settings();
      const inspectorOpen: boolean = this.inspectorOpen();
      const recordId: string | null = this.workspace.store.currentModelRecord()?.modelId ?? null;

      if (!this.rootGroupSelection) return;

      const hasGraphChanged: boolean = this.previousGraphData !== data;
      const haveSettingsChanged: boolean = this.previousSettings !== settings;
      if (!hasGraphChanged && !haveSettingsChanged && this.recordId === recordId && inspectorOpen === this.wasInspectorOpen)
        return;

      this.previousGraphData = data;
      this.previousSettings = settings;

      this.render(data);
      this.syncInspectorViewport(inspectorOpen);
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
    this.drawArrowMarker();

    this.zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .filter(
        (event: MouseEvent): boolean => (!event.ctrlKey || event.type === 'wheel') && !event.button && event.type !== 'dblclick',
      )
      .on('zoom', (event: ZoomEvent): void => {
        this.currentTransform = event.transform;
        this.rootGroupSelection?.attr('transform', event.transform.toString());
      })
      .on('end', (event: ZoomEvent): void => {
        if (event.sourceEvent) this.saveView();
      });

    this.svgSelection.call(this.zoomBehavior).on('dblclick.zoom', null);

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
    const needsFit: boolean = this.restorePositions(model, previous, saved);
    this.recordId = recordId;
    this.renderModel = model;
    this.linkSelection = this.drawLinks(this.rootGroupSelection, model.links);
    this.nodeSelection = this.drawNodes(this.rootGroupSelection, model.nodes);
    this.updateLinkPositions();
    this.updateNodePositions();
    this.updateNodeColorsOnly();
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
          (other: PositionedNode): boolean => Math.abs(other.x - position.x) < 176 && Math.abs(other.y - position.y) < 80,
        );
      if (position && !collides) {
        setNodePosition(node, position.x, position.y);
        retained.push(node);
      } else added.push(node);
    }
    const transform: ZoomTransform = saved
      ? d3.zoomIdentity.translate(saved.viewport.x, saved.viewport.y).scale(saved.viewport.scale)
      : this.currentTransform;
    return placeNodes(added, retained, getViewportSize(this.getHostElement()), this.settings().padding, transform);
  }

  private restoreViewport(saved: GraphView | undefined, fit: boolean, needsFit: boolean): void {
    if (needsFit) {
      this.fitToLayoutAnimated(0);
    } else if (saved) {
      this.applyViewTransform(d3.zoomIdentity.translate(saved.viewport.x, saved.viewport.y).scale(saved.viewport.scale), 0);
    } else if (fit) {
      this.fitToLayoutAnimated(0);
    }
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
    this.drawLinkTargets(rootGroupSelection, links);
    merged.on('click', (event: MouseEvent, link: ResolvedLink): void => this.handleLinkClick(event, link));
    return merged;
  }

  private drawLinkTargets(root: RootSelection, links: ResolvedLink[]): void {
    root
      .selectAll<SVGPathElement, ResolvedLink>('path.link-hit')
      .data(links, (link: ResolvedLink): string => link.id)
      .join('path')
      .attr('class', 'link-hit')
      .attr('fill', 'none')
      .on('click', (event: MouseEvent, link: ResolvedLink): void => this.handleLinkClick(event, link))
      .on('keydown', (event: KeyboardEvent, link: ResolvedLink): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.handleLinkClick(event, link);
      });
    this.updateLinkAccessibility();
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
            .on('click', this.handleNodeClick.bind(this))
            .on('dblclick', this.handleNodeDoubleClick.bind(this));

          this.drawNodeContent(g);

          return g;
        },
        (update) => update,
        (exit) => exit.remove(),
      );

    merged.select('rect.node-body').attr('role', 'button').attr('tabindex', 0);
    merged.on('keydown', this.handleNodeKeyDown.bind(this));
    this.updateNodeLabels(merged);

    return merged;
  }

  private drawNodeContent(g: NodeSelection): void {
    const content: NodeSelection = g.append('g').attr('class', 'node-content').attr('data-nori-motion', '');
    content
      .append('rect')
      .attr('class', 'node-body')
      .attr('x', -80)
      .attr('y', -32)
      .attr('width', 160)
      .attr('height', 64)
      .style('rx', 'var(--nori-radius-input)');
    g.append('title');
    content.append('text').attr('class', 'node-base').attr('dy', 17).attr('text-anchor', 'middle');
    content.append('text').attr('dy', -4).attr('text-anchor', 'middle').attr('font-size', 16);
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

  private updateNodeLabels(merged: NodeSelection): void {
    merged
      .select('text:not(.node-base)')
      .text((node: PositionedNode): string => (node.label.length > 20 ? `${node.label.slice(0, 19)}…` : node.label));
    merged
      .select('text.node-base')
      .text((node: PositionedNode): string =>
        ModelRef.isQualified(node.id)
          ? this.translations.translate('editor.fromModel', { name: node.modelName })
          : node.baseName
            ? this.translations.translate('editor.refines', { name: node.baseName.slice(0, 19) })
            : this.translations.translate('editor.baseNode'),
      );
    merged
      .select('title')
      .text(
        (node: PositionedNode): string =>
          `${node.label} · ${node.modelName}${node.baseName ? ` · ${this.translations.translate('editor.refines', { name: node.baseName })}` : ''}`,
      );
    merged
      .select('rect.node-body')
      .attr('aria-label', (node: PositionedNode): string => `${node.label}, ${node.baseName || node.modelName}`);
  }

  private updateNodeColorsOnly(): void {
    this.nodeSelection?.style('--g-node-fill', (node: PositionedNode): string => this.getNodeColor(node));
  }

  private getNodeColor(node: PositionedNode): string {
    return this.workspace.store.currentNodeColors()[node.superType] ?? 'var(--color-base-300)';
  }

  private updateNodePositions(): void {
    this.nodeSelection?.attr('transform', (node: PositionedNode): string => `translate(${node.x}, ${node.y})`);
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
  }

  private updateLinkAccessibility(): void {
    const removing: boolean = this.graphTools.tool() === 'disconnect';
    const active: Element | null = document.activeElement;
    if (!removing && active?.classList.contains('link-hit')) {
      this.focusSelectedNode();
    }
    this.rootGroupSelection
      ?.selectAll<SVGPathElement, ResolvedLink>('path.link-hit')
      .attr('role', removing ? 'button' : null)
      .attr('tabindex', removing ? 0 : -1)
      .attr('aria-hidden', removing ? null : 'true')
      .attr('aria-label', (link: ResolvedLink): string | null =>
        removing ? this.translations.translate('editor.removeNamedConnection', { name: link.label }) : null,
      );
  }

  private refreshHover(): void {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    if (selectedId && this.renderModel?.nodesById.has(selectedId)) this.applyHoverHighlight(selectedId);
    else this.clearHoverHighlight();
    this.applySelectedHighlight(selectedId);
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

    const isNodeRelated: (candidate: PositionedNode) => boolean = (candidate: PositionedNode): boolean =>
      relatedNodeIds.has(candidate.id);

    this.nodeSelection
      ?.classed('is-dimmed', (candidate: PositionedNode): boolean => !isNodeRelated(candidate))
      .classed('is-highlighted', (candidate: PositionedNode): boolean => isNodeRelated(candidate));

    this.rootGroupSelection
      ?.selectAll<SVGElement, ResolvedLink>('path.link, text.link-label')
      .classed('is-dimmed', (candidate: ResolvedLink): boolean => !relatedLinkIds.has(candidate.id))
      .classed('is-highlighted', (candidate: ResolvedLink): boolean => relatedLinkIds.has(candidate.id));
  }

  private clearHoverHighlight(): void {
    this.nodeSelection?.classed('is-dimmed', false).classed('is-highlighted', false);
    this.rootGroupSelection
      ?.selectAll<SVGElement, ResolvedLink>('path.link, text.link-label')
      .classed('is-dimmed', false)
      .classed('is-highlighted', false);
  }

  private createDragBehavior(): NodeDrag {
    return d3
      .drag<SVGGElement, PositionedNode>()
      .filter((): boolean => this.graphTools.tool() !== 'disconnect' && !this.graphTools.pending())
      .on('start', (event: d3.D3DragEvent<SVGGElement, PositionedNode, unknown>): void => {
        if (this.graphTools.tool() === 'connect') {
          this.clearConnectionTimer();
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
      if (Math.hypot(x - this.dragStart.x, y - this.dragStart.y) * this.currentTransform.k < 6) return;
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
      (node: PositionedNode): boolean => Math.abs(node.x - x) <= 80 && Math.abs(node.y - y) <= 32,
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
    if (this.graphTools.tool() === 'disconnect') return;
    if (this.graphTools.tool() === 'connect' && this.handleConnectionClick(event, node)) return;

    void this.navigation
      .navigateToNode(this.workspace.store.currentSlot(), node.id)
      .then((): void => this.nodeSelected.emit())
      .catch((error: unknown): void => this.storage.reportError(error));
  }

  private handleConnectionClick(event: MouseEvent | KeyboardEvent, node: PositionedNode): boolean {
    const source: string | null = this.graphTools.source();
    if (!source) {
      this.graphTools.selectSource(node.id);
      return false;
    }
    if (source === node.id && event instanceof MouseEvent) return false;

    if (event instanceof MouseEvent) this.scheduleConnection(source, node.id);
    else {
      this.graphTools.cancel();
      void this.graphTools.connect(source, node.id);
    }
    return true;
  }

  private handleNodeDoubleClick(event: MouseEvent, node: PositionedNode): void {
    if (this.graphTools.tool() !== 'connect') return;
    event.preventDefault();
    event.stopPropagation();
    this.clearConnectionTimer();
    this.graphTools.cancel();
    void this.graphTools.connect(node.id, node.id);
  }

  private handleLinkClick(event: MouseEvent | KeyboardEvent, link: ResolvedLink): void {
    event.stopPropagation();
    if (this.graphTools.tool() === 'disconnect') this.graphTools.remove(link.id);
  }

  private handleBackgroundClick(event: MouseEvent): void {
    const target: EventTarget | null = event.target;
    if (!(target instanceof Element)) return;

    const isOnNode: boolean = !!target.closest('g.node');
    const isOnLink: boolean = !!target.closest('path.link, path.link-hit');
    if (isOnNode || isOnLink) return;

    this.graphTools.cancel();
    void this.navigation
      .navigateToSlot(this.workspace.store.currentSlot())
      .catch((error: unknown): void => this.storage.reportError(error));
  }

  private focusSelectedNode(): void {
    const selectedId: string | null = this.workspace.store.currentNodeId();
    const target: SVGGElement | null | undefined =
      this.nodeSelection?.filter((node: PositionedNode): boolean => node.id === selectedId).node() ?? this.nodeSelection?.node();
    target?.querySelector<SVGRectElement>('rect.node-body')?.focus();
  }

  private syncInspectorViewport(open: boolean): void {
    if (this.inspectorRecordId !== this.recordId) {
      this.wasInspectorOpen = false;
      this.inspectorRecordId = this.recordId;
      this.inspectorTransition++;
    }
    if (open === this.wasInspectorOpen) return;
    this.wasInspectorOpen = open;

    const transition: number = ++this.inspectorTransition;
    if (!open) return;
    // Wait for panel padding to reach the graph before measuring its free area.
    this.scheduleFrame((): void => {
      if (transition !== this.inspectorTransition) return;
      const duration: number = this.appearance.state().animations ? 450 : 0;
      this.fitToLayoutAnimated(duration);
    });
  }

  private updateViewBox(): void {
    if (!this.svgSelection) return;
    const viewport: ViewportSize = getViewportSize(this.getHostElement());
    this.svgSelection.attr('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
  }

  private fitToLayoutAnimated(durationMilliseconds: number = 180): void {
    if (!this.svgSelection || !this.zoomBehavior || !this.rootGroupSelection) return;

    const rootGroupElement: SVGGElement | null = this.rootGroupSelection.node();
    if (!rootGroupElement) return;

    const viewport: ViewportSize = getViewportSize(this.getHostElement());
    const target: GraphView['viewport'] | null = getFitViewport(viewport, this.settings().padding, rootGroupElement.getBBox());
    if (!target) return;

    this.applyViewTransform(d3.zoomIdentity.translate(target.x, target.y).scale(target.scale), durationMilliseconds);
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

  private getHostElement(): HTMLDivElement {
    const element: HTMLDivElement | undefined = this.host()?.nativeElement;
    if (!element) throw new Error('Cannot render graph without host element.');
    return element;
  }

  // Defer the target click briefly so a double-click can choose a self-relationship.
  private scheduleConnection(source: string, target: string): void {
    this.clearConnectionTimer();
    this.connectionTimer = window.setTimeout((): void => {
      this.connectionTimer = null;
      this.graphTools.cancel();
      void this.graphTools.connect(source, target);
    }, 350);
  }

  private clearConnectionTimer(): void {
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
    this.clearConnectionTimer();
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
}
