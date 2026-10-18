import type { ELK, ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api';
import { placeRamenNodes } from './graph.layout';
import { GRAPH_NODE_WIDTH, GRAPH_NODE_HEIGHT, type PositionedNode, type RenderModel, type ResolvedLink } from './graph.types';

export type NodePosition = Readonly<{ x: number; y: number }>;

type NodeSpace = NodePosition & Readonly<{ right: number }>;

export class GraphAutoLayout {
  private engine?: Promise<ELK>;
  private worker: Worker | null = null;
  private destroyed: boolean = false;

  public destroy(): void {
    this.destroyed = true;
    this.worker?.terminate();
    this.worker = null;
  }

  public async arrange(model: RenderModel): Promise<ReadonlyMap<string, NodePosition>> {
    const nodes: PositionedNode[] = model.nodes.map((node: PositionedNode): PositionedNode => ({ ...node }));
    if (placeRamenNodes(nodes)) {
      return new Map(nodes.map((node: PositionedNode): [string, NodePosition] => [node.id, { x: node.x, y: node.y }]));
    }

    this.engine ??= this.loadEngine();
    const engine: ELK = await this.engine;
    const graph: ElkNode = await engine.layout(this.createGraph(model));
    const positions: Map<string, NodePosition> = new Map();
    for (const node of graph.children ?? []) {
      if (node.x === undefined || node.y === undefined) throw new Error('Graph layout returned an unpositioned node.');
      positions.set(node.id, { x: node.x + GRAPH_NODE_WIDTH / 2, y: node.y + GRAPH_NODE_HEIGHT / 2 });
    }
    return this.separateNodes(model, positions);
  }

  private async loadEngine(): Promise<ELK> {
    try {
      const { default: Elk } = await import('elkjs/lib/elk-api.js');
      if (this.destroyed) throw new Error('The graph layout has been disposed.');

      const worker: Worker = new Worker(new URL('workers/elk-worker.min.js', document.baseURI));
      this.worker = worker;
      return new Elk({ algorithms: ['stress'], workerFactory: (): Worker => worker });
    } catch (error: unknown) {
      this.worker?.terminate();
      this.worker = null;
      this.engine = undefined;
      throw error;
    }
  }

  private separateNodes(model: RenderModel, positions: ReadonlyMap<string, NodePosition>): ReadonlyMap<string, NodePosition> {
    const placed: Map<string, NodePosition> = new Map();
    const occupied: NodeSpace[] = [];
    for (const [id, position] of positions) {
      const loops: ResolvedLink[] = model.links.filter(
        (link: ResolvedLink): boolean => link.source.id === id && link.target.id === id,
      );
      const right: number = loops.reduce(
        (extent: number, link: ResolvedLink): number =>
          Math.max(extent, 184 + (link.loopIndex ?? 0) * 42 + link.label.length * 8),
        GRAPH_NODE_WIDTH / 2,
      );
      const free: NodePosition = this.findFreePosition(position, right, occupied);
      placed.set(id, free);
      occupied.push({ ...free, right });
    }
    return placed;
  }

  private findFreePosition(origin: NodePosition, right: number, occupied: readonly NodeSpace[]): NodePosition {
    const isFree: (position: NodePosition) => boolean = (position: NodePosition): boolean =>
      occupied.every(
        (other: NodeSpace): boolean =>
          position.x + right + 48 <= other.x - GRAPH_NODE_WIDTH / 2 ||
          other.x + other.right + 48 <= position.x - GRAPH_NODE_WIDTH / 2 ||
          Math.abs(position.y - other.y) >= GRAPH_NODE_HEIGHT + 64,
      );
    if (isFree(origin)) return origin;

    for (let ring: number = 1; ; ring++) {
      for (let step: number = -ring; step <= ring; step++) {
        for (const side of [-1, 1]) {
          const candidates: NodePosition[] = [
            { x: origin.x + step * 32, y: origin.y + side * ring * 32 },
            { x: origin.x + side * ring * 32, y: origin.y + step * 32 },
          ];
          const free: NodePosition | undefined = candidates.find(isFree);
          if (free) return free;
        }
      }
    }
  }

  private createGraph(model: RenderModel): ElkNode {
    return {
      id: 'graph',
      layoutOptions: {
        'elk.algorithm': 'stress',
        'elk.randomSeed': '1',
        'elk.stress.desiredEdgeLength': '300',
        'elk.stress.iterationLimit': '300',
        'elk.spacing.nodeNode': '64',
        'elk.spacing.componentComponent': '100',
        'elk.separateConnectedComponents': 'true',
      },
      children: model.nodes.map(
        (node: PositionedNode): ElkNode => ({
          id: node.id,
          width: GRAPH_NODE_WIDTH,
          height: GRAPH_NODE_HEIGHT,
        }),
      ),
      edges: model.links.map(
        (link: ResolvedLink): ElkExtendedEdge => ({
          id: link.id,
          sources: [link.source.id],
          targets: [link.target.id],
          labels: [{ text: link.label, width: link.label.length * 8, height: 20 }],
        }),
      ),
    };
  }
}
