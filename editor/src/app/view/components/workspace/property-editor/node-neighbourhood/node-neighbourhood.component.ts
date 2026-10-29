import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  untracked,
  viewChild,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideWaypoints, LucidePlus, LucideMinus, LucideScan, LucideArrowLeft, LucideArrowRight } from '@lucide/angular';
import { type Model, type NodeSuggestion } from '@ramen-suite/core/model';
import { Button } from '@sushi-kit/angular';
import * as d3 from 'd3';
import type { GraphView } from '../../../../../models/ModelRecord';
import { ApplicationState } from '../../../../../states/application.state';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';
import { GraphViewport } from '../../graph-view/graph/graph.viewport';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { getLinkPath } from '../../graph-view/graph/graph.geometry';
import { positionLinkLabels } from '../../graph-view/graph/graph.labels';
import { buildRenderModel, setNodePosition } from '../../graph-view/graph/graph.layout';
import { GraphRenderer } from '../../graph-view/graph/graph.renderer';
import {
  DEFAULT_GRAPH_LAYOUT_SETTINGS,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  type LinkSelection,
  type NodeSelection,
  type PositionedNode,
  type RenderModel,
  type ResolvedLink,
  type RootSelection,
  type SVGSelection,
} from '../../graph-view/graph/graph.types';
import {
  areGraphsEqual,
  buildNeighbourhoodGraph,
  buildVisibleModelGraph,
  type GraphData,
} from '../../graph-view/graph/model-graph';

const PREVIEW_PADDING: number = 32;

/** Shows the selected node's direct neighbourhood with the main graph's zoom, pan and entrance motion. */
@Component({
  selector: 'nori-node-neighbourhood',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipDirective,
    TranslocoDirective,
    Button,
    LucideWaypoints,
    LucidePlus,
    LucideMinus,
    LucideScan,
    LucideArrowLeft,
    LucideArrowRight,
  ],
  templateUrl: './node-neighbourhood.component.html',
  styleUrl: './node-neighbourhood.component.scss',
})
export class NodeNeighbourhoodComponent {
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly renderer: GraphRenderer = new GraphRenderer(this.translations);
  private readonly canvas: Signal<ElementRef<SVGSVGElement> | undefined> = viewChild<ElementRef<SVGSVGElement>>('canvas');
  private readonly host: Signal<ElementRef<HTMLDivElement> | undefined> = viewChild<ElementRef<HTMLDivElement>>('graphHost');
  private viewport: GraphViewport | null = null;
  private renderedData: GraphData | null = null;
  private root: { readonly svg: SVGSVGElement; readonly selection: RootSelection } | null = null;

  /** Relation IDs to emphasise, for example the relations an annotation rule may set. */
  public readonly highlightedRelations: InputSignal<ReadonlySet<string>> = input<ReadonlySet<string>>(new Set());
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly previousName: InputSignal<string | null> = input<string | null>(null);
  public readonly nextName: InputSignal<string | null> = input<string | null>(null);
  public readonly back: OutputEmitterRef<void> = output();
  public readonly forward: OutputEmitterRef<void> = output();
  public readonly inspect: OutputEmitterRef<string> = output();

  protected readonly graph: Signal<GraphData> = computed(
    (): GraphData => {
      const nodeId: string | null = this.workspace.store.currentNodeId();
      const model: Model | null = this.workspace.store.currentModel();
      if (!nodeId || !model) return { nodes: [], links: [] };
      const permitted: ReadonlySet<string> = new Set(
        this.workspace.queries.nodeSuggestions().map((node: NodeSuggestion): string => node.ref),
      );
      const visible: readonly string[] = this.workspace.store.currentModelRecord()?.view?.visibleNodeRefs ?? [];
      return buildNeighbourhoodGraph(buildVisibleModelGraph(model, this.workspace.store.getModels(), visible, permitted), nodeId);
    },
    { equal: areGraphsEqual },
  );

  public constructor() {
    effect((): void => {
      const svg: SVGSVGElement | undefined = this.canvas()?.nativeElement;
      const data: GraphData = this.graph();
      // Selection can change without changing the visible graph topology.
      this.workspace.store.currentNodeId();
      const colours: Readonly<Record<string, string>> = this.workspace.store.currentNodeColors();
      const highlighted: ReadonlySet<string> = this.highlightedRelations();
      const disabled: boolean = this.disabled();
      const host: HTMLDivElement | undefined = this.host()?.nativeElement;
      if (svg && host) untracked((): void => this.render(svg, host, data, colours, highlighted, disabled));
    });
    this.destroyRef.onDestroy((): void => {
      this.viewport?.destroy();
      const svg: SVGSVGElement | undefined = this.canvas()?.nativeElement;
      if (svg) d3.select(svg).selectAll('*').interrupt();
    });
  }

  private render(
    svg: SVGSVGElement,
    host: HTMLDivElement,
    data: GraphData,
    colours: Readonly<Record<string, string>>,
    highlighted: ReadonlySet<string>,
    disabled: boolean,
  ): void {
    const selection: SVGSelection = d3.select(svg);
    const root: RootSelection = this.mount(svg, host, selection);
    const model: RenderModel = this.layout(data);
    this.renderer.drawArrowMarker(selection);

    const links: LinkSelection = this.renderer.drawLinks(root, model.links);
    links.attr('d', (link: ResolvedLink): string => getLinkPath(link, model.nodes));
    root
      .selectAll<SVGPathElement, ResolvedLink>('path.link-hit')
      .attr('d', (link: ResolvedLink): string => getLinkPath(link, model.nodes));
    root
      .selectAll<SVGElement, ResolvedLink>('path.link, text.link-label')
      .classed('is-selected', (link: ResolvedLink): boolean => highlighted.has(link.id));

    const nodes: NodeSelection = this.renderer.drawNodes(root, model.nodes);
    const currentId: string | null = this.workspace.store.currentNodeId();
    nodes
      .attr('transform', (node: PositionedNode): string => `translate(${node.x}, ${node.y})`)
      .style('--g-node-fill', (node: PositionedNode): string => colours[node.superType] ?? 'var(--color-base-300)')
      .classed('is-selected', (node: PositionedNode): boolean => node.id === currentId);
    this.bindNodes(nodes, currentId, disabled);
    positionLinkLabels(root, links, model.nodes);
    if (data !== this.renderedData) {
      this.fit();
      this.renderedData = data;
    }
  }

  private mount(svg: SVGSVGElement, host: HTMLDivElement, selection: SVGSelection): RootSelection {
    if (this.root?.svg === svg) return this.root.selection;
    this.viewport?.destroy();
    const root: RootSelection = selection.append('g');
    this.root = { svg, selection: root };
    this.viewport = new GraphViewport(host, selection, root, {});
    this.renderedData = null;
    return root;
  }

  private layout(data: GraphData): RenderModel {
    const model: RenderModel = buildRenderModel({
      data,
      settings: DEFAULT_GRAPH_LAYOUT_SETTINGS,
      viewport: { width: 4 * GRAPH_NODE_WIDTH, height: 4 * GRAPH_NODE_HEIGHT },
    });
    const saved: GraphView['positions'] = this.workspace.store.currentModelRecord()?.view?.graph?.positions ?? {};
    for (const node of model.nodes) {
      const position: { x: number; y: number } | undefined = saved[node.id];
      if (position) setNodePosition(node, position.x, position.y);
    }
    return model;
  }

  private bindNodes(nodes: NodeSelection, currentId: string | null, disabled: boolean): void {
    const open: (node: PositionedNode) => void = (node: PositionedNode): void => {
      if (!disabled && node.id !== currentId) this.inspect.emit(node.id);
    };
    nodes
      .select<SVGRectElement>('rect.node-body')
      .attr('tabindex', (node: PositionedNode): number | null => (node.id === currentId || disabled ? null : 0))
      .attr('role', (node: PositionedNode): string | null => (node.id === currentId ? null : 'button'))
      .on('click', (_event: MouseEvent, node: PositionedNode): void => open(node))
      .on('keydown', (event: KeyboardEvent, node: PositionedNode): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open(node);
      });
  }

  protected fit(): void {
    this.viewport?.fit({ top: PREVIEW_PADDING, right: PREVIEW_PADDING, bottom: PREVIEW_PADDING, left: PREVIEW_PADDING }, 0);
  }

  protected zoom(factor: number): void {
    const motion: boolean = this.appearance.state().animations && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.viewport?.zoomBy(factor, motion ? 180 : 0);
  }

  protected handleGraphKey(event: KeyboardEvent): void {
    if (event.target !== this.canvas()?.nativeElement) return;
    if (event.key === '+' || event.key === '=') this.zoom(1.25);
    else if (event.key === '-') this.zoom(0.8);
    else if (event.key === '0') this.fit();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }
}
