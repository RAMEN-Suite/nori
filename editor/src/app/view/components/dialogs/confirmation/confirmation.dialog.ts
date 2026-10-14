import { ChangeDetectionStrategy, Component, inject, input, type InputSignal } from '@angular/core';
import { LucideCheck, LucideEraser, LucideX } from '@lucide/angular';
import { Button, type ButtonSeverity } from '@sushi-kit/angular';
import { type AffectedModelLevel, type AffectedRelation } from '../../../../utils/removal-summary';
import { type ConfirmationMessage } from '../../../../models/ConfirmationMessage';
import { type RemovalReviewPosition } from '../../../../services/workspace/workflows/removal-review.service';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { ConfirmationContentComponent, type AffectedNode } from './confirmation-content/confirmation-content.component';

export interface ConfirmationOptions {
  reviewPosition?: RemovalReviewPosition;
  title: string;
  message: ConfirmationMessage;
  details?: readonly string[];
  affectedNodes?: readonly AffectedNode[];
  affectedRelations?: readonly AffectedRelation[];
  affectedLevels?: readonly AffectedModelLevel[];
  buttons: ConfirmationButton[][];
}

export interface ConfirmationButton {
  label: string;
  severity?: ButtonSeverity;
  variant?: 'outlined' | 'text';
  click?: () => void | Promise<void>;
}

@Component({
  selector: 'nori-confirmation-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, ConfirmationContentComponent, LucideCheck, LucideEraser, LucideX],
  templateUrl: './confirmation.dialog.html',
})
export class ConfirmationDialog {
  protected readonly dialogs: DialogService = inject(DialogService);

  public readonly options: InputSignal<ConfirmationOptions> = input.required();

  protected async handleAction(button: ConfirmationButton): Promise<void> {
    const action: ConfirmationButton['click'] = button.click;
    if (!action) {
      this.dialogs.close();
      return;
    }

    await this.dialogs.run(async (): Promise<void> => {
      await action();
    });
  }
}
