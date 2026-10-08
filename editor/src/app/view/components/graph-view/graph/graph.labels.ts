import * as d3 from 'd3';
import { getLinkLabelPosition } from './graph.geometry';
import { type LinkSelection, type PositionedNode, type ResolvedLink, type RootSelection } from './graph.types';

type Box = Readonly<{ x: number; y: number; width: number; height: number }>;
type Point = Readonly<{ x: number; y: number }>;

function overlaps(left: Box, right: Box): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function captionBox(point: Point, width: number, height: number, self: boolean): Box {
  return { x: point.x - (self ? 0 : width / 2) - 4, y: point.y - height, width: width + 8, height: height + 4 };
}

function captionCandidates(path: SVGPathElement, link: ResolvedLink): Point[] {
  if (link.source === link.target) return [getLinkLabelPosition(link)];
  const length: number = path.getTotalLength();
  return [0.65, 0.35, 0.5, 0.2, 0.8].map((fraction: number): Point => {
    const point: DOMPoint = path.getPointAtLength(length * fraction);
    return { x: point.x, y: point.y - 10 };
  });
}

/** Keep each caption near its own edge and clear of nodes and earlier captions. */
export function positionLinkLabels(root: RootSelection, paths: LinkSelection, nodes: readonly PositionedNode[]): void {
  const occupied: Box[] = nodes.map((node: PositionedNode): Box => ({ x: node.x - 84, y: node.y - 36, width: 168, height: 72 }));
  const byId: Map<string, SVGPathElement> = new Map();
  paths.each(function (this: SVGPathElement, link: ResolvedLink): void {
    byId.set(link.id, this);
  });
  root.selectAll<SVGTextElement, ResolvedLink>('text.link-label').each(function (this: SVGTextElement, link: ResolvedLink): void {
    const path: SVGPathElement | undefined = byId.get(link.id);
    if (!path) return;
    const self: boolean = link.source === link.target;
    const size: DOMRect = this.getBBox();
    const candidates: Point[] = captionCandidates(path, link);
    const point: Point =
      candidates.find(
        (candidate: Point): boolean =>
          !occupied.some((box: Box): boolean => overlaps(captionBox(candidate, size.width, size.height, self), box)),
      ) ?? getLinkLabelPosition(link);
    d3.select(this)
      .attr('x', point.x)
      .attr('y', point.y)
      .style('text-anchor', self ? 'start' : 'middle');
    occupied.push(captionBox(point, size.width, size.height, self));
  });
}
