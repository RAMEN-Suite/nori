import { ChangeDetectionStrategy, Component, inject, input, type InputSignal } from '@angular/core';
import { Button, type ButtonSeverity } from '@sushi-kit/angular';
import { DialogService } from '../../../../services/dialog.service';

export interface ConfirmationOptions {
  title: string;
  message: string;
  plainText?: boolean;
  justify?: 'justify-center' | 'justify-between' | 'justify-around';
  buttons: ConfirmationButton[][];
}

export interface ConfirmationButton {
  label: string;
  severity?: ButtonSeverity;
  styleClass?: string;
  variant?: 'outlined' | 'text';
  size?: 'sm' | 'lg';
  click?: () => void | Promise<void>;
}

@Component({
  selector: 'app-confirmation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './confirmation.dialog.html',
  styleUrl: './confirmation.dialog.scss',
})
export class ConfirmationDialog {
  protected readonly dialogs: DialogService = inject(DialogService);
  public readonly options: InputSignal<ConfirmationOptions | undefined> = input();

  protected async handleAction(button: ConfirmationButton): Promise<void> {
    if (!button.click) {
      this.dialogs.close();
      return;
    }

    await this.dialogs.run(async (): Promise<void> => {
      await button.click?.();
    });
  }
}
