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

  // SVG mask references must remain unique when several instances are rendered.
  protected readonly maskId: string = `nori-brand-mask-${BrandIllustrationComponent.nextMaskId++}`;

  protected readonly graphNodes: readonly BrandNode[] = [
    { x: 70, y: 90, radius: 15, floatDelay: '0s' },
    { x: 165, y: 50, radius: 11, floatDelay: '-3s' },
    { x: 245, y: 85, radius: 18, floatDelay: '-6s' },
    { x: 95, y: 180, radius: 10, floatDelay: '-9s' },
    { x: 535, y: 155, radius: 22, floatDelay: '-12s' },
    { x: 600, y: 240, radius: 13, floatDelay: '-15s' },
    { x: 545, y: 340, radius: 18, floatDelay: '-18s' },
    { x: 610, y: 380, radius: 10, floatDelay: '-21s' },
    { x: 60, y: 345, radius: 18, floatDelay: '-24s' },
    { x: 85, y: 455, radius: 22, floatDelay: '-27s' },
    { x: 170, y: 470, radius: 12, floatDelay: '-30s' },
    { x: 28, y: 445, radius: 9, floatDelay: '-33s' },
  ];
}
