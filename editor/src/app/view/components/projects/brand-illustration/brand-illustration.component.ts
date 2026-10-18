import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Avatar, Card } from '@sushi-kit/angular';

interface BrandNode {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly floatDelay: string;
}

/** Decorative brand graph. It does not read or mutate a project model. */
@Component({
  selector: 'nori-brand-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Card],
  host: { 'aria-hidden': 'true' },
  templateUrl: './brand-illustration.component.html',
  styleUrl: './brand-illustration.component.scss',
})
export class BrandIllustrationComponent {
  private static nextMaskId: number = 0;
  protected readonly branches: readonly { readonly path: string; readonly delay: number }[] = [
    { path: 'M320 280L190 150', delay: 100 },
    { path: 'M320 280L470 120', delay: 100 },
    { path: 'M320 280L465 390', delay: 100 },
    { path: 'M320 280L135 390', delay: 100 },
    { path: 'M320 280L280 490', delay: 100 },
    { path: 'M190 150L70 90L5 55', delay: 600 },
    { path: 'M190 150L350 80', delay: 600 },
    { path: 'M190 150L70 255L135 390', delay: 600 },
    { path: 'M190 150L173 92', delay: 600 },
    { path: 'M470 120L590 210L592 70', delay: 600 },
    { path: 'M470 120L350 80', delay: 600 },
    { path: 'M470 120L529 40', delay: 600 },
    { path: 'M465 390L600 440', delay: 600 },
    { path: 'M465 390L422 500', delay: 600 },
    { path: 'M135 390L55 495L109 550', delay: 600 },
    { path: 'M280 490L365 532', delay: 600 },
  ];
  protected readonly maskId: string = `nori-brand-mask-${BrandIllustrationComponent.nextMaskId++}`;
  protected readonly graphNodes: readonly BrandNode[] = [
    { x: 70, y: 90, radius: 15, floatDelay: '0s' },
    { x: 190, y: 150, radius: 11, floatDelay: '-3s' },
    { x: 320, y: 280, radius: 23, floatDelay: '-6s' },
    { x: 70, y: 255, radius: 10, floatDelay: '-9s' },
    { x: 470, y: 120, radius: 22, floatDelay: '-12s' },
    { x: 590, y: 210, radius: 13, floatDelay: '-15s' },
    { x: 465, y: 390, radius: 18, floatDelay: '-18s' },
    { x: 600, y: 440, radius: 10, floatDelay: '-21s' },
    { x: 135, y: 390, radius: 18, floatDelay: '-24s' },
    { x: 55, y: 495, radius: 22, floatDelay: '-27s' },
    { x: 280, y: 490, radius: 12, floatDelay: '-30s' },
    { x: 350, y: 80, radius: 9, floatDelay: '-33s' },
  ];

  protected readonly nodeArrivalDelays: readonly number[] = this.graphNodes.map((node): number =>
    Math.round(Math.hypot(node.x - 320, node.y - 280) * 2.8),
  );
}
