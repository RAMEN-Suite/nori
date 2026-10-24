import { ChangeDetectionStrategy, Component, inject, input, type InputSignal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCopy, LucideCopySlash, LucideKeyRound, LucideListOrdered, LucideLockKeyhole } from '@lucide/angular';
import { type Attribute, type Bounds } from '@ramen-suite/core/model';
import { Badge } from '@sushi-kit/angular';
import { TooltipDirective } from '../../../../../../../directives/tooltip.directive';
import { WorkspaceService } from '../../../../../../../services/workspace/workspace.service';

/** Displays a property’s name, data type, bounds and status hints. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-node-attribute',
  imports: [
    TranslocoDirective,
    TooltipDirective,
    Badge,
    LucideCopy,
    LucideCopySlash,
    LucideListOrdered,
    LucideKeyRound,
    LucideLockKeyhole,
  ],
  templateUrl: './node-attribute.component.html',
  styleUrl: './node-attribute.component.scss',
})
export class NodeAttributeComponent {
  private readonly translations: TranslocoService = inject(TranslocoService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  public readonly focusable: InputSignal<boolean> = input(true);
  public readonly modelLevelIndex: InputSignal<number> = input(0);
  public readonly attribute: InputSignal<Attribute | undefined> = input();

  protected isMultiValue(bounds: Bounds): boolean {
    return bounds.upperBound === -1 || bounds.upperBound > 1;
  }

  protected formatBounds(bounds: Bounds): string {
    const { lowerBound: minimum, upperBound: maximum } = bounds;
    if (maximum === 1) return '';
    if (minimum === maximum) return ` [${maximum}]`;
    if (maximum === -1) return minimum <= 1 ? ' []' : ` [≥ ${minimum}]`;
    if (minimum <= 1) return ` [≤ ${maximum}]`;
    return ` [${minimum}–${maximum}]`;
  }

  protected formatAttributeCount(bounds: Bounds): string | null {
    const { lowerBound: minimum, upperBound: maximum } = bounds;
    const translate: (key: string, params?: Record<string, number>) => string = (key, params = {}): string =>
      this.translations.translate(`editor.propertyCount.${key}`, params);

    if (maximum === 0) return translate('none');
    if (maximum === 1 || (maximum === -1 && minimum <= 1)) return null;
    if (minimum === maximum) return translate('exact', { count: minimum });
    if (maximum === -1) return translate('atLeast', { count: minimum });
    if (minimum <= 1) return translate('atMost', { count: maximum });
    return translate('range', { minimum, maximum });
  }
}
