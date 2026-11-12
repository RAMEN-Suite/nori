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
  signal,
  untracked,
  viewChild,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideBox, LucidePalette, LucideNetwork, LucideScan, LucideSearch, LucideWaypoints } from '@lucide/angular';
import { ModelRef, type Model, type Node, type NodeSuggestion } from '@ramen-suite/core/model';
import {
  Autocomplete,
  AutocompleteItemTemplate,
  AutocompletePrefixTemplate,
  Button,
  type AutocompleteFilter,
  type AutocompleteOption,
} from '@sushi-kit/angular';
import * as d3 from 'd3';
import type { GraphView, ModelRecord } from '../../../../../models/ModelRecord';
import { ApplicationState } from '../../../../../states/application.state';
import { IconTooltipDirective } from '../../../../../directives/tooltip.directive';
import { DialogService } from '../../../../../services/interaction/dialog.service';
import { NodeColoursDialog } from '../../../dialogs/node-colors/node-colors.dialog';
import { animateGraphLayout, GRAPH_FIT_DURATION } from '../../graph-view/graph/graph.layout-motion';
import { type NodePosition } from '../../graph-view/graph/graph.auto-layout';
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

import { ProjectService } from '../../../../../services/projects/project.service';
import { ModelQueries } from '../../../../../utils/model-queries';
import { type NodeDefinition } from '../../../../../models/WorkspaceDetails';
import { type WorkspaceLocation } from '../../../../../models/WorkspaceLocation';

interface NodeSearchOption extends AutocompleteOption, NodeDefinition {
  readonly value: string;
  readonly modelName: string;
  readonly parentName: string | undefined;
}

const PREVIEW_PADDING: number = 32;

interface NeighbourhoodPositions {
  readonly initial: Map<string, NodePosition>;
  readonly local: Map<string, NodePosition>;
}

/** Shows the selected node's neighbourhood or the current model graph. */
@Component({
  selector: 'nori-node-neighbourhood',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconTooltipDirective,
    TranslocoDirective,
    Autocomplete,
    AutocompleteItemTemplate,
    AutocompletePrefixTemplate,
    Button,
    LucideBox,
    LucidePalette,
    LucideNetwork,
    LucideScan,
    LucideSearch,
    LucideWaypoints,
  ],
  templateUrl: './node-neighbourhood.component.html',
  styleUrl: './node-neighbourhood.component.scss',
})
export class NodeNeighbourhoodComponent {
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly workspace: WorkspaceService = inject(WorkspaceService);
  private readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly nodeSearch: Signal<Autocomplete<NodeSearchOption> | undefined> = viewChild(Autocomplete<NodeSearchOption>);
  public readonly inspectSearchResult: OutputEmitterRef<NodeDefinition> = output();
  protected readonly searchOptions: Signal<readonly NodeSearchOption[]> = computed((): readonly NodeSearchOption[] => {
    const currentNodeId: string | null = this.workspace.store.currentNodeId();
    const currentModelId: string | undefined = this.workspace.queries.nodeOwner()?.gmodel.id;
    const collator: Intl.Collator = new Intl.Collator(this.appearance.language(), { numeric: true, sensitivity: 'base' });
    const records: ModelRecord[] = this.projects.records();
    const models: Map<string, Model> = new Map(
      records.map((record: ModelRecord): [string, Model] => [record.gmodel.id, record.gmodel]),
    );
    return [...records]
      .sort((left: ModelRecord, right: ModelRecord): number => right.levelIndex - left.levelIndex)
      .flatMap((record: ModelRecord): NodeSearchOption[] =>
        ModelQueries.nodes(record.gmodel)
          .filter(
            (node: Node): boolean =>
              !currentNodeId ||
              record.gmodel.id !== currentModelId ||
              !ModelRef.matches(currentNodeId, record.gmodel.id, node.id),
          )
          .sort((left: Node, right: Node): number => collator.compare(left.name, right.name))
          .map((node: Node): NodeSearchOption => ({
            value: ModelRef.qualify(record.gmodel.id, node.id),
            label: node.name,
            modelName: record.name,
            parentName: ModelQueries.parentNodeName(node, record.gmodel.id, models),
            modelId: record.gmodel.id,
            node,
          })),
      );
  });
  protected readonly searchQuery: WritableSignal<string> = signal('');
  protected readonly matchesSearch: AutocompleteFilter = (option: AutocompleteOption, query: string): boolean =>
    option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  protected readonly firstMatchByModel: Signal<ReadonlyMap<string, NodeSearchOption>> = computed(
    (): ReadonlyMap<string, NodeSearchOption> => {
      const query: string = this.searchQuery();
      const firstMatches: Map<string, NodeSearchOption> = new Map();
      for (const option of this.searchOptions()) {
        if (!firstMatches.has(option.modelId) && this.matchesSearch(option, query)) firstMatches.set(option.modelId, option);
      }
      return firstMatches;
    },
  );
  protected readonly suggestionsMessage: (count: number) => string = (count: number): string =>
    this.translations.translate(count === 1 ? 'common.suggestionOne' : 'common.suggestionMany', { count });
  protected readonly isFullGraphVisible: WritableSignal<boolean> = signal(false);
  private readonly viewKey: Signal<string> = computed((): string =>
    JSON.stringify([
      this.workspace.store.currentModel()?.id,
      this.isFullGraphVisible(),
      this.isFullGraphVisible() ? null : this.workspace.store.currentNodeId(),
    ]),
  );
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly positionsByFocus: Map<string, NeighbourhoodPositions> = new Map();
  private readonly renderer: GraphRenderer = new GraphRenderer(this.translations);
  private readonly canvas: Signal<ElementRef<SVGSVGElement> | undefined> = viewChild<ElementRef<SVGSVGElement>>('canvas');
  private readonly host: Signal<ElementRef<HTMLDivElement> | undefined> = viewChild<ElementRef<HTMLDivElement>>('graphHost');
  private viewport: GraphViewport | null = null;
  private restoreInitialLayout?: () => void;
  private renderedView: string | undefined;
  private root: { readonly svg: SVGSVGElement; readonly selection: RootSelection } | null = null;

  /** Relation IDs to emphasise, for example the relations an annotation rule may set. */
  public readonly highlightedRelations: InputSignal<ReadonlySet<string>> = input<ReadonlySet<string>>(new Set());
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly inspect: OutputEmitterRef<WorkspaceLocation> = output();

  protected readonly areControlsBusy: Signal<boolean> = computed((): boolean => this.disabled() || !!this.dialogs.current());

  protected readonly graph: Signal<GraphData> = computed(
    (): GraphData => {
      const nodeId: string | null = this.workspace.store.currentNodeId();
      const model: Model | null = this.workspace.store.currentModel();
      if (!nodeId || !model) return { nodes: [], links: [] };
      const visible: readonly string[] = this.workspace.store.currentModelRecord()?.view?.visibleNodeRefs ?? [];
      const permitted: ReadonlySet<string> = new Set(
        this.workspace.queries.nodeSuggestions().map((node: NodeSuggestion): string => node.ref),
      );
      const graph: GraphData = buildVisibleModelGraph(model, this.workspace.store.getModels(), visible, permitted);
      return this.isFullGraphVisible() ? graph : buildNeighbourhoodGraph(graph, nodeId);
    },
    { equal: areGraphsEqual },
  );

  protected selectSearchResult(value: unknown): void {
    if (typeof value !== 'string') return;
    this.nodeSearch()?.reset();
    if (this.areControlsBusy()) return;
    const option: NodeSearchOption | undefined = this.searchOptions().find((item): boolean => item.value === value);
    if (!option) return;
    this.inspectSearchResult.emit(option);
  }

  public constructor() {
    effect((): void => {
      const svg: SVGSVGElement | undefined = this.canvas()?.nativeElement;
      const data: GraphData = this.graph();
      const view: string = this.viewKey();
      const colours: Readonly<Record<string, string>> = this.workspace.store.currentNodeColours();
      const highlighted: ReadonlySet<string> = this.highlightedRelations();
      const currentId: string | null = this.workspace.store.currentNodeId();
      const host: HTMLDivElement | undefined = this.host()?.nativeElement;
      if (svg && host) untracked((): void => this.render(svg, host, data, view, colours, highlighted, currentId));
    });
    this.destroyRef.onDestroy((): void => {
      this.root?.selection.interrupt('layout');
      this.viewport?.destroy();
      const svg: SVGSVGElement | undefined = this.canvas()?.nativeElement;
      if (svg) d3.select(svg).selectAll('*').interrupt();
    });
  }

  private render(
    svg: SVGSVGElement,
    host: HTMLDivElement,
    data: GraphData,
    view: string,
    colours: Readonly<Record<string, string>>,
    highlighted: ReadonlySet<string>,
    currentId: string | null,
  ): void {
    const selection: SVGSelection = d3.select(svg);
    const root: RootSelection = this.mount(svg, host, selection);
    root.interrupt('layout');
    const model: RenderModel = this.layout(data);
    this.renderer.drawArrowMarker(selection);

    const links: LinkSelection = this.renderer.drawLinks(root, model.links);
    root
      .selectAll<SVGElement, ResolvedLink>('path.link, text.link-label')
      .classed('is-selected', (link: ResolvedLink): boolean => highlighted.has(link.id));

    const nodes: NodeSelection = this.renderer.drawNodes(root, model.nodes);
    nodes
      .style('--g-node-fill', (node: PositionedNode): string => colours[node.superType] ?? 'var(--color-base-300)')
      .classed('is-selected', (node: PositionedNode): boolean => node.id === currentId);
    this.bindNodes(nodes, currentId);
    this.updatePositions(root, nodes, links, model);
    this.bindDragging(root, nodes, links, model);
    this.restoreInitialLayout = (): void => this.animatePositions(root, nodes, links, model, this.positions().initial);
    if (view !== this.renderedView && model.nodes.length) {
      this.fit();
      this.renderedView = view;
    }
  }

  private bindDragging(root: RootSelection, nodes: NodeSelection, links: LinkSelection, model: RenderModel): void {
    const localPositions: Map<string, NodePosition> = this.positions().local;
    nodes.call(
      d3
        .drag<SVGGElement, PositionedNode>()
        .clickDistance(4)
        .filter((event: MouseEvent): boolean => !this.areControlsBusy() && !event.button && !event.ctrlKey)
        .on('start', (): void => {
          root.interrupt('layout');
        })
        .on('drag', (event: d3.D3DragEvent<SVGGElement, PositionedNode, PositionedNode>, node: PositionedNode): void => {
          setNodePosition(node, event.x, event.y);
          localPositions.set(node.id, { x: node.x, y: node.y });
          this.updatePositions(root, nodes, links, model);
        }),
    );
  }

  private mount(svg: SVGSVGElement, host: HTMLDivElement, selection: SVGSelection): RootSelection {
    if (this.root?.svg === svg) return this.root.selection;
    this.viewport?.destroy();
    const root: RootSelection = selection.append('g');
    this.root = { svg, selection: root };
    this.viewport = new GraphViewport(host, selection, root, {});
    this.renderedView = undefined;
    return root;
  }

  private updatePositions(root: RootSelection, nodes: NodeSelection, links: LinkSelection, model: RenderModel): void {
    nodes.attr('transform', (node: PositionedNode): string => `translate(${node.x}, ${node.y})`);
    links.attr('d', (link: ResolvedLink): string => getLinkPath(link, model.nodes));
    root
      .selectAll<SVGPathElement, ResolvedLink>('path.link-hit')
      .attr('d', (link: ResolvedLink): string => getLinkPath(link, model.nodes));
    positionLinkLabels(root, links, model.nodes);
  }

  private positions(): NeighbourhoodPositions {
    const focus: string = this.viewKey();
    let positions: NeighbourhoodPositions | undefined = this.positionsByFocus.get(focus);
    if (!positions) {
      positions = { initial: new Map(), local: new Map() };
      this.positionsByFocus.set(focus, positions);
    }
    return positions;
  }

  private defaultLayout(data: GraphData): RenderModel {
    return buildRenderModel({
      data,
      settings: DEFAULT_GRAPH_LAYOUT_SETTINGS,
      viewport: { width: 4 * GRAPH_NODE_WIDTH, height: 4 * GRAPH_NODE_HEIGHT },
    });
  }

  private layout(data: GraphData): RenderModel {
    const model: RenderModel = this.defaultLayout(data);
    const positions: NeighbourhoodPositions = this.positions();
    const saved: GraphView['positions'] = this.workspace.store.currentModelRecord()?.view?.graph?.positions ?? {};
    for (const node of model.nodes) {
      const initial: NodePosition = positions.initial.get(node.id) ?? saved[node.id] ?? { x: node.x, y: node.y };
      positions.initial.set(node.id, initial);
      const position: NodePosition = positions.local.get(node.id) ?? initial;
      setNodePosition(node, position.x, position.y);
    }
    return model;
  }

  private bindNodes(nodes: NodeSelection, currentId: string | null): void {
    const open: (node: PositionedNode) => void = (node: PositionedNode): void => {
      const record: ModelRecord | null = this.workspace.store.currentModelRecord();
      if (record && !this.areControlsBusy() && node.id !== currentId)
        this.inspect.emit({ projectId: record.projectId, levelIndex: record.levelIndex, nodeId: node.id });
    };
    nodes
      .select<SVGRectElement>('rect.node-body')
      .attr('tabindex', (node: PositionedNode): number | null => (node.id === currentId ? null : 0))
      .attr('role', (node: PositionedNode): string | null => (node.id === currentId ? null : 'button'))
      .on('click', (_event: MouseEvent, node: PositionedNode): void => open(node))
      .on('keydown', (event: KeyboardEvent, node: PositionedNode): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open(node);
      });
  }

  protected openColours(): void {
    if (this.areControlsBusy()) return;
    this.dialogs.open(NodeColoursDialog, {
      closeOnBackdrop: true,
      width: '28rem',
      headerKey: 'editor.adjustNodeColours',
    });
  }

  protected resetLayout(): void {
    if (this.areControlsBusy()) return;
    this.restoreInitialLayout?.();
  }

  protected toggleFullGraph(): void {
    if (this.areControlsBusy()) return;
    this.isFullGraphVisible.update((visible: boolean): boolean => !visible);
  }

  private animatePositions(
    root: RootSelection,
    nodes: NodeSelection,
    links: LinkSelection,
    model: RenderModel,
    positions: ReadonlyMap<string, NodePosition>,
  ): void {
    const localPositions: Map<string, NodePosition> = this.positions().local;
    const motion: boolean = this.appearance.isMotionEnabled();
    animateGraphLayout(
      root,
      model,
      positions,
      motion,
      (): void => {
        for (const node of model.nodes) localPositions.set(node.id, { x: node.x, y: node.y });
        this.updatePositions(root, nodes, links, model);
      },
      (): void => this.fit(motion ? GRAPH_FIT_DURATION : 0),
    );
  }

  protected fit(duration: number = 0): void {
    this.viewport?.fit(
      {
        top: PREVIEW_PADDING,
        right: PREVIEW_PADDING,
        bottom: this.isFullGraphVisible() ? 2 * PREVIEW_PADDING : PREVIEW_PADDING,
        left: PREVIEW_PADDING,
      },
      duration,
      4,
    );
  }

  protected zoom(factor: number): void {
    const motion: boolean = this.appearance.isMotionEnabled();
    this.viewport?.zoomBy(factor, motion ? 180 : 0);
  }

  protected handleGraphKey(event: KeyboardEvent): void {
    if (event.target !== this.canvas()?.nativeElement || this.areControlsBusy()) return;
    if (event.key === '+' || event.key === '=') this.zoom(1.25);
    else if (event.key === '-') this.zoom(0.8);
    else if (event.key === '0') this.fit();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }
}
