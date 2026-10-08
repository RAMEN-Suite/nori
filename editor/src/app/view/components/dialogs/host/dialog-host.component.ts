import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { Dialog, DialogHeader, DialogBody, Message } from '@sushi-kit/angular';
import { DialogService } from '../../../../services/dialog.service';

/** Hosts reusable Nori forms inside Sushi's accessible dialog. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dialog-host',
  imports: [NgComponentOutlet, Dialog, DialogHeader, DialogBody, Message],
  template: `
    <sui-dialog
      #dialog="suiDialog"
      style="--sui-dialog-width: var(--nori-dialog-width); --sui-dialog-radius: var(--nori-radius)"
      [open]="dialogs.current() !== null"
      [ariaLabel]="dialogs.current()?.title || 'Confirm action'"
      [closeOnEscape]="!dialogs.pending()"
      [closeOnBackdrop]="false"
      (closed)="handleClosed(dialog)"
    >
      @if (dialogs.current()?.title; as title) {
        <header suiDialogHeader>{{ title }}</header>
      }
      <div suiDialogBody>
        @if (dialogs.current(); as current) {
          @if (dialogs.error(); as error) {
            <p suiMessage severity="error">{{ error }}</p>
          }
          <ng-container [ngComponentOutlet]="current.component" [ngComponentOutletInputs]="current.inputs" />
        }
      </div>
    </sui-dialog>
  `,
})
export class DialogHostComponent {
  protected readonly dialogs: DialogService = inject(DialogService);

  protected handleClosed(dialog: Dialog): void {
    if (this.dialogs.pending()) {
      dialog.show();
      return;
    }

    this.dialogs.close();
  }
}
