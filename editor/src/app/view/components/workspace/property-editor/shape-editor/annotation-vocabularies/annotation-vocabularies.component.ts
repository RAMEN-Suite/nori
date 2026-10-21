import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideBookOpen, LucideChevronDown, LucidePlus } from '@lucide/angular';
import { Button, Checkbox, List, ListItemTemplate } from '@sushi-kit/angular';
import { ScrollOverflowDirective } from '../../../../../../directives/scroll-overflow.directive';
import { ScrollHintsComponent } from '../../../../shared/scroll-hints/scroll-hints.component';

import { ANNOTATION_VOCABULARIES, type AnnotationPreset, type AnnotationVocabulary } from './annotation-vocabularies';

@Component({
  selector: 'nori-annotation-vocabularies',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoDirective,
    Button,
    Checkbox,
    List,
    ListItemTemplate,
    LucideBookOpen,
    LucideChevronDown,
    LucidePlus,
    ScrollOverflowDirective,
    ScrollHintsComponent,
  ],
  templateUrl: './annotation-vocabularies.component.html',
  styleUrl: './annotation-vocabularies.component.scss',
})
export class AnnotationVocabulariesComponent {
  public readonly existingTypes: InputSignal<readonly string[]> = input<readonly string[]>([]);
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly add: OutputEmitterRef<readonly AnnotationPreset[]> = output();
  protected readonly vocabularies: readonly AnnotationVocabulary[] = ANNOTATION_VOCABULARIES;
  protected readonly expanded: WritableSignal<string | null> = signal(null);
  protected readonly selected: WritableSignal<readonly string[]> = signal([]);
  protected readonly availableSelection: Signal<readonly AnnotationPreset[]> = computed(() => {
    const vocabulary: AnnotationVocabulary | undefined = this.vocabularies.find(
      (item: AnnotationVocabulary): boolean => item.id === this.expanded(),
    );
    return vocabulary
      ? this.available(vocabulary).filter((annotation: AnnotationPreset): boolean => this.selected().includes(annotation.type))
      : [];
  });

  protected available(vocabulary: AnnotationVocabulary): readonly AnnotationPreset[] {
    return vocabulary.annotations.filter(
      (annotation: AnnotationPreset): boolean => !this.existingTypes().includes(annotation.type),
    );
  }

  protected toggleVocabulary(id: string): void {
    this.expanded.update((current: string | null): string | null => (current === id ? null : id));
    this.selected.set([]);
  }

  protected toggleType(type: string): void {
    this.selected.update((types: readonly string[]): readonly string[] =>
      types.includes(type) ? types.filter((item: string): boolean => item !== type) : [...types, type],
    );
  }
}
