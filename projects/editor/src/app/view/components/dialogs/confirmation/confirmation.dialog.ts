import { Component, inject, input, InputSignal } from '@angular/core';
import { Button, ButtonSeverity } from 'primeng/button';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

export interface ConfirmationOptions {
  title: string;
  icon: string;
  message: string;
  justify?: 'justify-center' | 'justify-between' | 'justify-around';
  buttons: ConfirmationButton[][];
}

export interface ConfirmationButton {
  label: string;
  severity?: ButtonSeverity;
  styleClass?: string;
  variant?: 'outlined' | 'text';
  size?: 'small' | 'large';
  click?: () => void;
}

@Component({
  selector: 'app-unsaved-changes',
  imports: [Button],
  templateUrl: './confirmation.dialog.html',
  styleUrl: './confirmation.dialog.scss',
})
export class ConfirmationDialog {
  protected readonly dialogRef: DynamicDialogRef = inject(DynamicDialogRef);
  public options: InputSignal<ConfirmationOptions | undefined> = input();
}
