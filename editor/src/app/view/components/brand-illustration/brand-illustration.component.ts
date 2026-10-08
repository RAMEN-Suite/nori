import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Avatar, Card } from '@sushi-kit/angular';

interface GraphNode {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly delay: string;
}

/** Decorative brand graph. It does not read or mutate a project model. */
@Component({
  selector: 'app-brand-illustration',
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

  protected readonly graphNodes: readonly GraphNode[] = [
    { x: 70, y: 90, radius: 15, delay: '0s' },
    { x: 165, y: 50, radius: 11, delay: '-3s' },
    { x: 245, y: 85, radius: 18, delay: '-6s' },
    { x: 95, y: 180, radius: 10, delay: '-9s' },
    { x: 535, y: 155, radius: 22, delay: '-12s' },
    { x: 600, y: 240, radius: 13, delay: '-15s' },
    { x: 545, y: 340, radius: 18, delay: '-18s' },
    { x: 610, y: 380, radius: 10, delay: '-21s' },
    { x: 60, y: 345, radius: 18, delay: '-24s' },
    { x: 85, y: 455, radius: 22, delay: '-27s' },
    { x: 170, y: 470, radius: 12, delay: '-30s' },
    { x: 28, y: 445, radius: 9, delay: '-33s' },
  ];
}
