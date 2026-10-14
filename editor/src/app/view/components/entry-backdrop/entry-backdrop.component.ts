import { ChangeDetectionStrategy, Component } from '@angular/core';

interface BackdropNode {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

@Component({
  selector: 'nori-entry-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', inert: '' },
  templateUrl: './entry-backdrop.component.html',
  styleUrl: './entry-backdrop.component.scss',
})
export class EntryBackdropComponent {
  protected readonly corners: readonly string[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  protected readonly nodes: readonly BackdropNode[] = [
    { x: 28, y: 40, radius: 12 },
    { x: 135, y: 66, radius: 16 },
    { x: 240, y: 24, radius: 10 },
    { x: 355, y: 60, radius: 13 },
    { x: 65, y: 155, radius: 15 },
    { x: 180, y: 145, radius: 10 },
    { x: 22, y: 265, radius: 11 },
    { x: 102, y: 290, radius: 13 },
  ];
}
