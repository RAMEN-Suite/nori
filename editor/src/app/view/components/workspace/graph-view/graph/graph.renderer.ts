import { TranslocoService } from '@jsverse/transloco';
import { ModelRef } from '@ramen-suite/core/model';
import type { Selection } from 'd3';
import { getLinkPath } from './graph.geometry';
import {
  GRAPH_NODE_WIDTH,
  GRAPH_NODE_HEIGHT,
  type LinkSelection,
  type NodeSelection,
  type PositionedNode,
  type RenderModel,
  type ResolvedLink,
  type RootSelection,
  type SVGSelection,
} from './graph.types';

export class GraphRenderer {
  public constructor(private readonly translations: TranslocoService) {}

  public drawLinks(rootGroupSelection: RootSelection, links: ResolvedLink[]): LinkSelection {
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
    return merged;
  }

  public drawNodes(rootGroupSelection: RootSelection, nodes: PositionedNode[]): NodeSelection {
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
            .attr('data-nori-motion', '');

          this.drawNodeContent(g);

          return g;
        },
        (update) => update,
        (exit) => exit.remove(),
      );

    merged.select('rect.node-body').attr('role', 'button').attr('tabindex', 0);
    this.updateNodeLabels(merged);

    return merged;
  }

  public drawArrowMarker(svg: SVGSelection): void {
    const defs: Selection<SVGDefsElement, number, SVGSVGElement, unknown> = svg
      .selectAll<SVGDefsElement, unknown>('defs')
      .data([0])
      .join('defs');

    const marker: Selection<SVGMarkerElement, number, SVGDefsElement, number> = defs
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
      .attr('fill', 'context-stroke');
  }

  public updateNodeLabels(merged: NodeSelection): void {
    merged
      .select('text:not(.node-base)')
      .text((node: PositionedNode): string => (node.label.length > 16 ? `${node.label.slice(0, 15)}…` : node.label));
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

  public applyHoverHighlight(root: RootSelection, nodes: NodeSelection, model: RenderModel, nodeId: string | null): void {
    if (!nodeId || !model.nodesById.has(nodeId)) return;

    const relatedNodeIds: Set<string> = new Set<string>([nodeId]);
    const relatedLinkIds: Set<string> = new Set<string>();

    for (const link of model.links) {
      if (link.source.id === nodeId || link.target.id === nodeId) {
        relatedNodeIds.add(link.source.id);
        relatedNodeIds.add(link.target.id);
        relatedLinkIds.add(link.id);
      }
    }

    nodes.classed('is-dimmed', (candidate: PositionedNode): boolean => !relatedNodeIds.has(candidate.id));

    root
      .selectAll<SVGElement, ResolvedLink>('path.link, text.link-label')
      .classed('is-dimmed', (candidate: ResolvedLink): boolean => !relatedLinkIds.has(candidate.id));
  }

  public drawRelationFeedback(root: RootSelection, model: RenderModel, relationId: string | null, selecting: boolean): void {
    const target: ResolvedLink | undefined = model.links.find((link: ResolvedLink): boolean => link.id === relationId);
    const feedback: Selection<SVGGElement, ResolvedLink, SVGGElement, unknown> = root
      .selectAll<SVGGElement, ResolvedLink>('g.link-feedback')
      .data(target ? [target] : [])
      .join((enter) => enter.insert('g', 'text.link-label'))
      .attr('class', selecting ? 'link-feedback is-relation-selection' : 'link-feedback')
      .attr('aria-hidden', 'true');
    feedback
      .selectAll<SVGPathElement, string>('path')
      .data(['halo', 'stroke'])
      .join('path')
      .attr('class', (kind: string): string => `link-feedback-${kind}`)
      .attr('fill', 'none')
      .attr('marker-end', (kind: string): string | null => (kind === 'stroke' ? 'url(#g-arrow)' : null))
      .attr('d', target ? getLinkPath(target, model.nodes) : '');
  }

  public clearHoverHighlight(root: RootSelection, nodes: NodeSelection): void {
    nodes.classed('is-dimmed', false);
    root.selectAll<SVGElement, ResolvedLink>('path.link, text.link-label').classed('is-dimmed', false);
  }

  private drawLinkTargets(root: RootSelection, links: ResolvedLink[]): void {
    root
      .selectAll<SVGPathElement, ResolvedLink>('path.link-hit')
      .data(links, (link: ResolvedLink): string => link.id)
      .join('path')
      .attr('class', 'link-hit')
      .attr('fill', 'none');
  }

  private drawNodeContent(g: NodeSelection): void {
    const content: NodeSelection = g.append('g').attr('class', 'node-content').attr('data-nori-motion', '');
    content
      .append('rect')
      .attr('class', 'node-body')
      .attr('x', -GRAPH_NODE_WIDTH / 2)
      .attr('y', -GRAPH_NODE_HEIGHT / 2)
      .attr('width', GRAPH_NODE_WIDTH)
      .attr('height', GRAPH_NODE_HEIGHT)
      .style('rx', 'var(--nori-radius-input)');

    g.append('title');
    content.append('text').attr('class', 'node-base').attr('dy', 17).attr('text-anchor', 'middle');
    content.append('text').attr('dy', -4).attr('text-anchor', 'middle').attr('font-size', 16);
  }
}
