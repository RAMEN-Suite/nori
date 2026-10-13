import { ChangeDetectionStrategy, Component, input, output, type InputSignal, type OutputEmitterRef } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideFolderOpen, LucideFolderPlus } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';

@Component({
  selector: 'app-project-alternative',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, LucideFolderOpen, LucideFolderPlus],
  templateUrl: './project-alternative.component.html',
})
export class ProjectAlternativeComponent {
  public readonly current: InputSignal<'create' | 'open'> = input.required<'create' | 'open'>();
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly selected: OutputEmitterRef<void> = output();
}
