import { GRAPH_NODE_WIDTH, type PositionedNode, type ResolvedLink } from './graph.types';

const HALF_NODE_WIDTH: number = GRAPH_NODE_WIDTH / 2;

type Point = Readonly<{ x: number; y: number }>;

/** Clip a connection at the node's rectangle, towards the curve's control point. */
function nodeBoundary(node: PositionedNode, towards: Point, padding: number = 0): Point {
  const dx: number = towards.x - node.x;
  const dy: number = towards.y - node.y;
  const length: number = Math.hypot(dx, dy);
  if (length < 0.001) return { x: node.x + HALF_NODE_WIDTH + padding, y: node.y };
  const ux: number = dx / length;
  const uy: number = dy / length;
  const distance: number = Math.min(HALF_NODE_WIDTH / Math.abs(ux), 32 / Math.abs(uy)) + padding;
  return { x: node.x + ux * distance, y: node.y + uy * distance };
}

function curveControl(link: ResolvedLink, nodes: readonly PositionedNode[] = []): Point {
  const dx: number = link.target.x - link.source.x;
  const dy: number = link.target.y - link.source.y;
  const length: number = Math.hypot(dx, dy) || 1;
  const bend: number = (link.curveOffset ?? 0) * 2;
  const control: { x: number; y: number } = {
    x: (link.source.x + link.target.x) / 2 - (dy / length) * bend,
    y: (link.source.y + link.target.y) / 2 + (dx / length) * bend,
  };
  for (const node of nodes) {
    if (node === link.source || node === link.target) continue;
    if (curveCrossesNode(link, control, node)) control.x += control.x < node.x ? -240 : 240;
  }
  return control;
}

function curveCrossesNode(link: ResolvedLink, control: Point, node: PositionedNode): boolean {
  for (let step: number = 1; step < 10; step++) {
    const t: number = step / 10;
    const x: number = (1 - t) ** 2 * link.source.x + 2 * (1 - t) * t * control.x + t * t * link.target.x;
    const y: number = (1 - t) ** 2 * link.source.y + 2 * (1 - t) * t * control.y + t * t * link.target.y;
    if (Math.abs(x - node.x) < HALF_NODE_WIDTH + 28 && Math.abs(y - node.y) < 56) return true;
  }
  return false;
}

export function getLinkPath(link: ResolvedLink, nodes: readonly PositionedNode[] = []): string {
  const source: PositionedNode = link.source;
  if (source === link.target) {
    return getLoopPath(link);
  }
  const control: Point = curveControl(link, nodes);
  const start: Point = nodeBoundary(source, control);
  const end: Point = nodeBoundary(link.target, control, 5);
  return `M ${start.x},${start.y} Q ${control.x},${control.y} ${end.x},${end.y}`;
}

export function getLinkLabelPosition(link: ResolvedLink): Point {
  if (link.source === link.target) {
    return loopPoint(link, 184 + (link.loopIndex ?? 0) * 42, (link.loopIndex ?? 0) * 24);
  }
  const control: Point = curveControl(link);
  const start: Point = nodeBoundary(link.source, control);
  const end: Point = nodeBoundary(link.target, control, 5);
  const dx: number = link.target.x - link.source.x;
  const dy: number = link.target.y - link.source.y;
  const length: number = Math.hypot(dx, dy) || 1;
  const offset: number = Math.sign(link.curveOffset ?? 0) * 12;
  return {
    x: (start.x + 2 * control.x + end.x) / 4 - (dy / length) * offset,
    y: (start.y + 2 * control.y + end.y) / 4 + (dx / length) * offset - 8,
  };
}

/** Rotate reference-model loops towards the outside of the diamond. */
function loopPoint(link: ResolvedLink, x: number, y: number): Point {
  const angle: number = { right: 0, bottom: Math.PI / 2, left: Math.PI, top: -Math.PI / 2 }[link.loopSide ?? 'right'];
  const radial: number = link.loopSide === 'top' || link.loopSide === 'bottom' ? x - (HALF_NODE_WIDTH - 32) : x;
  return {
    x: link.source.x + radial * Math.cos(angle) - y * Math.sin(angle),
    y: link.source.y + radial * Math.sin(angle) + y * Math.cos(angle),
  };
}

function getLoopPath(link: ResolvedLink): string {
  const reach: number = 64 + (link.loopIndex ?? 0) * 28;
  const start: Point = loopPoint(link, HALF_NODE_WIDTH, -16);
  const first: Point = loopPoint(link, HALF_NODE_WIDTH + reach * 2, -16 - reach);
  const second: Point = loopPoint(link, HALF_NODE_WIDTH + reach * 2, 16 + reach);
  const end: Point = loopPoint(link, HALF_NODE_WIDTH + 5, 16);
  return `M ${start.x},${start.y} C ${first.x},${first.y} ${second.x},${second.y} ${end.x},${end.y}`;
}
