import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  output,
  type InputSignal,
  type ModelSignal,
  type OutputEmitterRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Input } from '@sushi-kit/angular';
import { AutoselectDirective } from '../../../../directives/autoselect.directive';

@Component({
  selector: 'nori-inline-name-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Input, AutoselectDirective],
  host: { class: 'contents' },
  template: `
    <input
      suiInput
      fluid
      [class]="fieldClass()"
      [attr.name]="name()"
      noriAutoselect
      size="sm"
      [attr.maxlength]="maxLength()"
      [attr.aria-label]="label()"
      [ngModel]="value()"
      (ngModelChange)="value.set($event)"
      [readOnly]="readOnly()"
      (keydown.enter)="$event.preventDefault(); submitted.emit()"
      (keydown.escape)="$event.stopPropagation(); cancelled.emit()"
      (blur)="focusLeft.emit()"
    />
  `,
})
export class InlineNameInputComponent {
  public readonly fieldClass: InputSignal<string> = input('');
  public readonly name: InputSignal<string | null> = input<string | null>(null);
  public readonly label: InputSignal<string> = input.required<string>();
  public readonly maxLength: InputSignal<number | null> = input<number | null>(null);
  public readonly readOnly: InputSignal<boolean> = input(false);
  public readonly value: ModelSignal<string> = model.required<string>();
  public readonly submitted: OutputEmitterRef<void> = output();
  public readonly focusLeft: OutputEmitterRef<void> = output();
  public readonly cancelled: OutputEmitterRef<void> = output();
}
