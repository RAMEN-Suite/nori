import { ChangeDetectionStrategy, Component, output, type OutputEmitterRef } from '@angular/core';

@Component({
  selector: 'nori-logo-intro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  templateUrl: './logo-intro.component.html',
  styleUrl: './logo-intro.component.scss',
})
export class LogoIntroComponent {
  private static nextMaskId: number = 0;
  protected readonly maskId: string = `nori-intro-ring-${LogoIntroComponent.nextMaskId++}`;
  public readonly completed: OutputEmitterRef<void> = output();
  protected readonly tiles: readonly {
    readonly x: number;
    readonly y: number;
    readonly spreadX: number;
    readonly spreadY: number;
  }[] = [
    { x: 0, y: -27, spreadX: 0, spreadY: -185 },
    { x: -27, y: 0, spreadX: -225, spreadY: 0 },
    { x: 27, y: 0, spreadX: 225, spreadY: 0 },
    { x: 0, y: 27, spreadX: 0, spreadY: 185 },
  ];

  protected finish(event: AnimationEvent): void {
    if (event.target === event.currentTarget) this.completed.emit();
  }
}
