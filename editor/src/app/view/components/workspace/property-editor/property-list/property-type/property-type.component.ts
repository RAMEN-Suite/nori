import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  viewChild,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideList } from '@lucide/angular';
import { TooltipDirective } from '../../../../../../directives/tooltip.directive';
import { Autocomplete, AutocompleteItemTemplate, Button, type AutocompleteOption } from '@sushi-kit/angular';

@Component({
  selector: 'nori-property-type',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Autocomplete, AutocompleteItemTemplate, Button, LucideList, TooltipDirective],
  templateUrl: './property-type.component.html',
})
export class PropertyTypeComponent {
  private readonly autocomplete: Signal<Autocomplete | undefined> = viewChild(Autocomplete);
  public readonly options: InputSignal<readonly AutocompleteOption[]> = input.required();
  public readonly value: InputSignal<string> = input.required();
  public readonly multiple: InputSignal<boolean> = input(false);
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly label: InputSignal<string> = input.required();
  public readonly typeChange: OutputEmitterRef<string> = output();
  public readonly arrayChange: OutputEmitterRef<boolean> = output();

  protected restoreType(): void {
    const control: Autocomplete | undefined = this.autocomplete();
    if (control?.value() === null) control.value.set(this.value());
  }

  protected selectType(value: unknown): void {
    if (typeof value !== 'string' || !this.options().some((option) => option.value === value)) return;
    this.typeChange.emit(value);
    // Let Sushi complete its selection and clear the query before closing.
    queueMicrotask(() => this.autocomplete()?.hide());
  }
}
