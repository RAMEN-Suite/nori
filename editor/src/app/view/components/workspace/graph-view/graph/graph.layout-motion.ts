import { easeCubicInOut } from 'd3';
import { type NodePosition } from './graph.auto-layout';
import { setNodePosition } from './graph.layout';
import { type PositionedNode, type RenderModel, type RootSelection } from './graph.types';

export const GRAPH_FIT_DURATION: number = 400;

export function animateGraphLayout(
  root: RootSelection | undefined,
  model: RenderModel,
  positions: ReadonlyMap<string, NodePosition>,
  motion: boolean,
  update: () => void,
  done: () => void,
): void {
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
    update();
  };
  root?.interrupt('layout');
  if (!motion) {
    move(1);
    done();
    return;
  }
  root
    ?.transition('layout')
    .duration(450)
    .ease(easeCubicInOut)
    .tween('positions', (): ((progress: number) => void) => move)
    .on('end', (): void => done());
}
