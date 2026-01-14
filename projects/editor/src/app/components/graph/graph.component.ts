import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Input,
  output,
  OutputEmitterRef,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { GraphData, GraphLink, GraphNode } from '../../core/GModelGraph';
import * as d3 from 'd3';

type D3Node = GraphNode & d3.SimulationNodeDatum;
type D3Link = GraphLink & d3.SimulationLinkDatum<D3Node>;

@Component({
  selector: 'app-graph',
  imports: [],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.scss',
})
export class GraphComponent {
  @Input({ required: true }) public data!: GraphData | null;

  public readonly nodeClick: OutputEmitterRef<GraphNode> = output<GraphNode>();
  public readonly linkClick: OutputEmitterRef<GraphLink> = output<GraphLink>();

  @ViewChild('host', { static: true }) private readonly hostRef!: ElementRef<HTMLDivElement>;
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private root: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private simulation: d3.Simulation<D3Node, undefined> | null = null;
  private ro: ResizeObserver | null = null;

  public ngAfterViewInit(): void {
    if (this.data === null) return;

    this.mount();
    this.render(this.data);

    this.destroyRef.onDestroy((): void => {
      this.cleanup();
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (this.data === null) return;

    if (!this.svg) return;
    if (changes['data']) this.render(this.data);
  }

  private mount(): void {
    const host: HTMLDivElement = this.hostRef.nativeElement;

    this.svg = d3
      .select(host)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('user-select', 'none');

    this.root = this.svg.append('g');

    this.svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => {
          this.root?.attr('transform', event.transform.toString());
        }),
    );

    this.ro = new ResizeObserver((): void => {
      this.updateViewBox();
      this.simulation?.alpha(0.25).restart();
    });
    this.ro.observe(host);

    this.updateViewBox();
    this.ensureSimulation();
  }

  private render(data: GraphData): void {
    if (!this.root || !this.simulation) return;

    // normalize
    const nodes: D3Node[] = data.nodes.map((n) => ({ ...n }));
    const links: D3Link[] = data.links.map((l) => ({ ...l })) as D3Link[];

    // --- LINKS
    const linkSel = this.root
      .selectAll<SVGLineElement, D3Link>('line.link')
      .data(links, (d) => d.id);

    linkSel.exit().remove();

    const link = linkSel
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', 'currentColor') // <- wichtig, sonst unsichtbar
      .attr('stroke-width', 1)
      .attr('opacity', 0.35)
      .on('click', (_e, l) => this.linkClick.emit(l))
      .merge(linkSel);

    // --- NODES
    const nodeSel = this.root.selectAll<SVGGElement, D3Node>('g.node').data(nodes, (d) => d.id);

    nodeSel.exit().remove();

    const nodeEnter = nodeSel.enter().append('g').attr('class', 'node').call(this.drag());

    nodeEnter
      .append('circle')
      .attr('r', 14)
      .attr('stroke-width', 1.25)
      .attr('stroke-dasharray', (d) => (d.kind === 'Unknown' ? '3 2' : null))
      .on('click', (_e, n) => this.nodeClick.emit(n));

    nodeEnter
      .append('text')
      .attr('dx', 18)
      .attr('dy', 4)
      .attr('font-size', 12)
      .attr('pointer-events', 'none')
      .text((d) => d.label ?? d.refId ?? d.id);

    const node = nodeEnter.merge(nodeSel);

    // simulation wiring
    this.simulation.nodes(nodes);

    const linkForce = this.simulation.force('link') as d3.ForceLink<D3Node, D3Link>;
    linkForce.links(links);

    this.simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x ?? 0)
        .attr('y1', (d) => (d.source as D3Node).y ?? 0)
        .attr('x2', (d) => (d.target as D3Node).x ?? 0)
        .attr('y2', (d) => (d.target as D3Node).y ?? 0);

      node.attr('transform', (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    });

    this.simulation.alpha(1).restart();
  }

  private ensureSimulation(): void {
    if (this.simulation) return;

    const host: HTMLDivElement = this.hostRef.nativeElement;
    const w: number = host.clientWidth || 800;
    const h: number = host.clientHeight || 500;

    this.simulation = d3
      .forceSimulation<D3Node>()
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>()
          .id((n) => n.id)
          .distance(90),
      )
      .force('charge', d3.forceManyBody().strength(-260))
      .force('collide', d3.forceCollide(26))
      .force('center', d3.forceCenter(w / 2, h / 2));
  }

  private drag(): d3.DragBehavior<SVGGElement, D3Node, unknown> {
    return d3
      .drag<SVGGElement, D3Node>()
      .on('start', (event, n) => {
        if (!this.simulation) return;
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        n.fx = n.x;
        n.fy = n.y;
      })
      .on('drag', (event, n) => {
        n.fx = event.x;
        n.fy = event.y;
      })
      .on('end', (event, n) => {
        if (!this.simulation) return;
        if (!event.active) this.simulation.alphaTarget(0);
        n.fx = null;
        n.fy = null;
      });
  }

  private updateViewBox(): void {
    if (!this.svg) return;

    const host: HTMLDivElement = this.hostRef.nativeElement;
    const w: number = host.clientWidth || 800;
    const h: number = host.clientHeight || 500;
    this.svg.attr('viewBox', `0 0 ${w} ${h}`);
  }

  private cleanup(): void {
    this.ro?.disconnect();
    this.ro = null;

    this.simulation?.stop();
    this.simulation = null;

    this.svg?.remove();
    this.svg = null;
    this.root = null;
  }
}
