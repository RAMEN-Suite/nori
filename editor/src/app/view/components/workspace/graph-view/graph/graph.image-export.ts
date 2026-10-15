export type GraphImageFormat = 'svg' | 'png';

type ExportColour = Readonly<{ hex: string; alpha: number }>;

const EXPORT_STYLES: readonly string[] = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linejoin',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'rx',
];

/** Captures the full graph as transparent SVG or PNG without interaction decorations. */
export class GraphImageExport {
  private static readonly PADDING: number = 32;
  private static readonly PNG_SCALE: number = 2;
  private static readonly PNG_MAX_EDGE: number = 8192;

  public static svg(svg: SVGSVGElement, root: SVGGElement): Blob {
    const snapshot: SVGSVGElement = this.snapshot(svg, root);
    this.convertColours(snapshot);
    return new Blob([new XMLSerializer().serializeToString(snapshot)], { type: 'image/svg+xml' });
  }

  public static async png(svg: Blob): Promise<Blob> {
    const url: string = URL.createObjectURL(svg);
    try {
      const image: HTMLImageElement = new Image();
      image.src = url;
      await image.decode();
      const scale: number = Math.min(this.PNG_SCALE, this.PNG_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas: HTMLCanvasElement = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.ceil(image.naturalHeight * scale));
      const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
      if (!context) throw new Error('Cannot create graph image.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject): void => {
        canvas.toBlob((blob: Blob | null): void => {
          if (blob) resolve(blob);
          else reject(new Error('Cannot encode graph image.'));
        }, 'image/png');
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private static snapshot(svg: SVGSVGElement, root: SVGGElement): SVGSVGElement {
    const bounds: DOMRect = root.getBBox();
    const width: number = Math.ceil(bounds.width + this.PADDING * 2);
    const height: number = Math.ceil(bounds.height + this.PADDING * 2);
    const snapshot: SVGSVGElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    snapshot.setAttribute('version', '1.1');
    snapshot.setAttribute('width', String(width));
    snapshot.setAttribute('height', String(height));
    snapshot.setAttribute('viewBox', `${bounds.x - this.PADDING} ${bounds.y - this.PADDING} ${width} ${height}`);
    const content: Element = this.copyElement(root);
    content.removeAttribute('transform');
    content
      .querySelectorAll('.link-hit, .link-feedback, .connection-preview, title')
      .forEach((element: Element): void => element.remove());
    const colour: string = getComputedStyle(svg).color;
    this.prepareRelations(content, colour);
    this.appendArrowheads(content, root, colour);
    snapshot.append(content);
    return snapshot;
  }

  private static copyElement(original: Element): Element {
    const copy: Node = original.cloneNode(false);
    if (!(copy instanceof Element)) throw new Error('Cannot copy graph element.');
    const styles: CSSStyleDeclaration = getComputedStyle(original);
    copy.removeAttribute('style');
    copy.removeAttribute('paint-order');
    copy.removeAttribute('rx');
    for (const property of EXPORT_STYLES) {
      const value: string = styles.getPropertyValue(property);
      if (value && value !== 'auto') copy.setAttribute(property, value);
    }
    for (const child of original.childNodes) {
      copy.append(child instanceof Element ? this.copyElement(child) : child.cloneNode(true));
    }
    if (original.classList.contains('node-base')) copy.setAttribute('opacity', '0.6');
    return copy;
  }

  private static prepareRelations(content: Element, colour: string): void {
    content.querySelectorAll('.link').forEach((link: Element): void => {
      link.setAttribute('stroke', colour);
      link.setAttribute('fill', 'none');
      link.setAttribute('stroke-opacity', '1');
      link.setAttribute('stroke-width', '1.5');
      link.setAttribute('stroke-linecap', 'round');
      link.setAttribute('stroke-linejoin', 'round');
      link.removeAttribute('marker-end');
    });
    content.querySelectorAll('.link-label').forEach((label: Element): void => {
      label.setAttribute('fill', colour);
      const outline: Node = label.cloneNode(true);
      if (outline instanceof Element) {
        outline.setAttribute('fill', 'none');
        outline.setAttribute('aria-hidden', 'true');
        label.before(outline);
      }
      label.setAttribute('stroke', 'none');
    });
  }

  private static appendArrowheads(content: Element, root: SVGGElement, colour: string): void {
    const originals: NodeListOf<SVGPathElement> = root.querySelectorAll('path.link');
    content.querySelectorAll('path.link').forEach((link: Element, index: number): void => {
      const original: SVGPathElement | undefined = originals[index];
      if (!original) return;
      const length: number = original.getTotalLength();
      if (!length) return;
      const end: DOMPoint = original.getPointAtLength(length);
      const before: DOMPoint = original.getPointAtLength(Math.max(0, length - 0.1));
      const angle: number = (Math.atan2(end.y - before.y, end.x - before.x) * 180) / Math.PI;
      const arrow: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrow.setAttribute('d', 'M -5.5 -5 L 4.5 0 L -5.5 5 Z');
      arrow.setAttribute('transform', `translate(${end.x} ${end.y}) rotate(${angle})`);
      arrow.setAttribute('fill', colour);
      arrow.setAttribute('stroke', 'none');
      link.after(arrow);
    });
  }

  private static convertColours(snapshot: SVGSVGElement): void {
    const context: CanvasRenderingContext2D | null = document.createElement('canvas').getContext('2d');
    if (!context) throw new Error('Cannot resolve graph colours.');
    const colours: Map<string, ExportColour> = new Map();
    snapshot.querySelectorAll('*').forEach((element: Element): void => {
      for (const property of ['fill', 'stroke']) {
        const value: string | null = element.getAttribute(property);
        if (!value || value === 'none') continue;
        let colour: ExportColour | undefined = colours.get(value);
        if (!colour) {
          colour = this.resolveColour(context, value);
          colours.set(value, colour);
        }
        element.setAttribute(property, colour.hex);
        if (colour.alpha < 1) {
          const opacity: number = Number(element.getAttribute(`${property}-opacity`) ?? 1);
          element.setAttribute(`${property}-opacity`, String(opacity * colour.alpha));
        }
      }
    });
  }

  private static resolveColour(context: CanvasRenderingContext2D, value: string): ExportColour {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const channels: Uint8ClampedArray = context.getImageData(0, 0, 1, 1).data;
    const hex: string = Array.from(channels.slice(0, 3))
      .map((channel: number): string => channel.toString(16).padStart(2, '0'))
      .join('');
    return { hex: `#${hex}`, alpha: (channels[3] ?? 255) / 255 };
  }
}
