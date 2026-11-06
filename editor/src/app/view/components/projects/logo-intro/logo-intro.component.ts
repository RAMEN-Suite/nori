import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  type OnInit,
  output,
  signal,
  type OutputEmitterRef,
  type WritableSignal,
} from '@angular/core';

@Component({
  selector: 'nori-logo-intro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.intro-leaving]': 'isLeaving()',
    '(animationend)': 'finish($event)',
  },
  templateUrl: './logo-intro.component.html',
  styleUrl: './logo-intro.component.scss',
})
export class LogoIntroComponent implements OnInit {
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  protected readonly isLeaving: WritableSignal<boolean> = signal(false);
  public readonly revealing: OutputEmitterRef<void> = output();
  public readonly completed: OutputEmitterRef<void> = output();

  public ngOnInit(): void {
    const timeout: ReturnType<typeof setTimeout> = setTimeout((): void => this.reveal(), 6000);
    this.destroyRef.onDestroy((): void => clearTimeout(timeout));
  }

  protected reveal(): void {
    if (this.isLeaving()) return;
    this.isLeaving.set(true);
    this.revealing.emit();
  }

  protected finish(event: AnimationEvent): void {
    if (event.target === event.currentTarget) this.completed.emit();
  }
}
