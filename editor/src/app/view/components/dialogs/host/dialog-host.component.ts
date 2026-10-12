import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  Injector,
  effect,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideCircleAlert } from '@lucide/angular';
import { NgComponentOutlet } from '@angular/common';
import { Dialog, DialogHeader, DialogBody, Message } from '@sushi-kit/angular';
import { DialogService, type OpenDialog } from '../../../../services/dialog.service';
import { ApplicationState } from '../../../../states/application.state';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dialog-host',
  imports: [TranslocoPipe, NgComponentOutlet, Dialog, DialogHeader, DialogBody, Message, LucideCircleAlert],
  template: `
    <sui-dialog
      #dialog="suiDialog"
      style="--sui-dialog-radius: var(--nori-radius); --sui-dialog-border-color: var(--nori-border); --sui-dialog-shadow: none; --sui-dialog-enter-duration: 240ms; --sui-dialog-exit-duration: 180ms; --sui-dialog-motion-easing: cubic-bezier(0.22, 1, 0.36, 1)"
      [style.--sui-dialog-width]="content()?.width ?? 'var(--nori-dialog-width)'"
      [open]="dialogs.current() !== null && contentReady()"
      [ariaLabel]="content()?.title || (content()?.titleKey || 'common.confirm' | transloco)"
      [closeLabel]="'common.close' | transloco"
      [motion]="appearance.state().animations ? 'fade' : 'none'"
      [closeOnEscape]="!dialogs.pending()"
      [closeOnBackdrop]="false"
      (closed)="handleClosed(dialog)"
    >
      @if (content(); as current) {
        <header suiDialogHeader>{{ current.titleKey ? (current.titleKey | transloco) : current.title }}</header>
      }
      <div suiDialogBody>
        @if (content(); as current) {
          @if (dialogs.error(); as error) {
            <div suiMessage severity="error" variant="soft" class="mb-4 flex items-center gap-3" role="alert">
              <svg lucideCircleAlert class="size-5 shrink-0" aria-hidden="true"></svg>
              <p class="text-sm leading-relaxed">{{ error }}</p>
            </div>
          }
          <ng-container [ngComponentOutlet]="current.component" [ngComponentOutletInputs]="current.inputs" />
        }
      </div>
    </sui-dialog>
  `,
})
export class DialogHostComponent {
  protected readonly dialogs: DialogService = inject(DialogService);
  protected readonly appearance: ApplicationState = inject(ApplicationState);
  protected readonly content: WritableSignal<OpenDialog | null> = signal(null);

  private readonly injector: Injector = inject(Injector);
  protected readonly contentReady: WritableSignal<boolean> = signal(false);

  public constructor() {
    effect((): void => {
      const current: OpenDialog | null = this.dialogs.current();
      this.contentReady.set(false);
      if (!current) return;
      this.content.set(current);
      afterNextRender(
        (): void => {
          if (this.dialogs.current() === current) this.contentReady.set(true);
        },
        { injector: this.injector },
      );
    });
  }

  protected handleClosed(dialog: Dialog): void {
    if (this.dialogs.pending()) {
      dialog.show();
      return;
    }

    this.dialogs.close();
    this.content.set(null);
  }
}
