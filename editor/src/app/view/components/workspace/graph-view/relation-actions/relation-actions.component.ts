import { ChangeDetectionStrategy, Component, inject, input, type InputSignal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideTrash } from '@lucide/angular';
import { Button, Card } from '@sushi-kit/angular';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';
import { RelationEditingService } from '../../../../../services/workspace/editing/relation-editing.service';

/** Provides removal of the selected relationship through the shared confirmation flow. */
@Component({
  selector: 'nori-relation-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, Card, TooltipDirective, LucideTrash],
  templateUrl: './relation-actions.component.html',
  styleUrl: './relation-actions.component.scss',
})
export class RelationActionsComponent {
  protected readonly relationEditing: RelationEditingService = inject(RelationEditingService);

  public readonly relationId: InputSignal<string> = input.required<string>();
}
