import * as d3 from 'd3';
import { type ZoomTransform } from 'd3';
import { type GraphView } from '../../../../../models/ModelRecord';
import { getFitViewport, getViewportSize } from './graph.layout';
import {
  type GraphPadding,
  type RootSelection,
  type SVGSelection,
  type ZoomBehaviour,
  type ZoomEvent,
  type ViewportSize,
} from './graph.types';

interface ViewportCallbacks {
  readonly onTransformChange?: () => void;
  readonly onTransformEnd?: () => void;
}

/** Owns graph zoom, view-box resizing and viewport fitting; the caller owns persistence. */
export class GraphViewport {
  private readonly zoom: ZoomBehaviour;
  private readonly resizeObserver: ResizeObserver;
  private resizeFrame: number | null = null;
  private currentTransform: ZoomTransform = d3.zoomIdentity;

  public constructor(
    private readonly host: HTMLDivElement,
    private readonly svg: SVGSelection,
    private readonly root: RootSelection,
    private readonly callbacks: ViewportCallbacks,
  ) {
    this.zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .filter(
        (event: MouseEvent): boolean => (!event.ctrlKey || event.type === 'wheel') && !event.button && event.type !== 'dblclick',
      )
      .on('zoom', (event: ZoomEvent): void => {
        this.currentTransform = event.transform;
        this.root.attr('transform', event.transform.toString());
        this.callbacks.onTransformChange?.();
      })
      .on('end', (event: ZoomEvent): void => {
        if (event.sourceEvent) this.callbacks.onTransformEnd?.();
      });
    this.svg.call(this.zoom).on('dblclick.zoom', null);

    this.resizeObserver = new ResizeObserver((): void => this.scheduleResize());
    this.resizeObserver.observe(this.host);
    this.updateViewBox();
  }

  public get transform(): ZoomTransform {
    return this.currentTransform;
  }

  public fit(padding: GraphPadding, duration: number, maxScale?: number): void {
    const root: SVGGElement | null = this.root.node();
    if (!root) return;
    const bounds: DOMRect = root.getBBox();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const target: GraphView['viewport'] | null = getFitViewport(getViewportSize(this.host), padding, bounds, maxScale);
    if (target) this.applyTransform(d3.zoomIdentity.translate(target.x, target.y).scale(target.scale), duration);
  }

  public zoomBy(factor: number, duration: number): void {
    this.svg.interrupt();
    if (duration === 0) this.svg.call(this.zoom.scaleBy, factor);
    else this.svg.transition().duration(duration).ease(d3.easeCubicInOut).call(this.zoom.scaleBy, factor);
  }

  public applyTransform(transform: ZoomTransform, duration: number): void {
    this.svg.interrupt();
    if (duration === 0) {
      this.svg.call(this.zoom.transform, transform);
      return;
    }
    this.svg
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .call(this.zoom.transform, transform)
      .on('end', (): void => this.callbacks.onTransformEnd?.());
  }

  public destroy(): void {
    this.resizeObserver.disconnect();
    if (this.resizeFrame !== null) window.cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = null;
    this.svg.interrupt().on('.zoom', null);
  }

  private scheduleResize(): void {
    if (this.resizeFrame !== null) return;
    this.resizeFrame = window.requestAnimationFrame((): void => {
      this.resizeFrame = null;
      this.updateViewBox();
    });
  }

  private updateViewBox(): void {
    const size: ViewportSize = getViewportSize(this.host);
    this.svg.attr('viewBox', `0 0 ${size.width} ${size.height}`);
  }
}
