import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  type InputSignal,
  type ModelSignal,
  type Signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { DESCRIPTION_MAX_LENGTH } from '@ramen-suite/core/model';
import { Textarea } from '@sushi-kit/angular';
import { descriptionLength } from '../../../../utils/descriptions';

@Component({
  selector: 'nori-description-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoDirective, Textarea],
  host: { class: 'block min-w-0' },
  template: `
    <div *transloco="let t" class="flex min-w-0 flex-col gap-1.5 text-xs" [class.opacity-50]="disabled()">
      <label [for]="inputId()" class="nori-field-label"
        >{{ t('editor.description.label') }} <span class="nori-field-optional">{{ t('create.optional') }}</span></label
      >
      <textarea
        suiTextarea
        fluid
        size="sm"
        rows="3"
        class="text-base"
        data-description-input
        [id]="inputId()"
        [ngModel]="value()"
        (ngModelChange)="value.set($event)"
        [ngModelOptions]="{ standalone: true }"
        [disabled]="disabled()"
        [invalid]="tooLong()"
        [touched]="tooLong()"
        [attr.aria-invalid]="tooLong() ? 'true' : null"
        [attr.aria-describedby]="inputId() + '-count' + (tooLong() ? ' ' + inputId() + '-error' : '')"
      ></textarea>
      <div class="flex items-start justify-between gap-3 font-normal">
        @if (tooLong()) {
          <span [id]="inputId() + '-error'" class="text-error" role="alert">{{
            t('editor.description.tooLong', { maximum: limit })
          }}</span>
        }
        <span
          [id]="inputId() + '-count'"
          class="text-base-content/50 ml-auto shrink-0 tabular-nums"
          [class.text-error]="tooLong()"
          >{{ length() }} / {{ limit }}</span
        >
      </div>
    </div>
  `,
})
export class DescriptionFieldComponent {
  public readonly inputId: InputSignal<string> = input.required();
  public readonly value: ModelSignal<string> = model('');
  public readonly disabled: InputSignal<boolean> = input(false);
  protected readonly limit: number = DESCRIPTION_MAX_LENGTH;
  protected readonly length: Signal<number> = computed(() => descriptionLength(this.value()));
  protected readonly tooLong: Signal<boolean> = computed(() => this.length() > this.limit);
}
