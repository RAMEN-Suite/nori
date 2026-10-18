import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  viewChild,
  computed,
  afterNextRender,
  Injector,
  effect,
  inject,
  signal,
  type WritableSignal,
  type Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideCircleAlert } from '@lucide/angular';
import { Dialog, DialogHeader, DialogBody, Message, type DialogPosition, type DialogCoordinates } from '@sushi-kit/angular';
import { DialogService, type OpenDialog } from '../../../../services/interaction/dialog.service';
import { ApplicationState } from '../../../../states/application.state';
import { NodeColorsDialog } from '../../dialogs/node-colors/node-colors.dialog';
import { SettingsDialog } from '../../dialogs/settings/settings.dialog';
import { ConfirmationDialog } from '../../dialogs/confirmation/confirmation.dialog';

/** Opens shared dialogs before expanding their dependent removal details. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-dialog-host',
  imports: [TranslocoPipe, NgComponentOutlet, Dialog, DialogHeader, DialogBody, Message, LucideCircleAlert],
  template: `
    @for (frame of frames(); track frame.component) {
      <sui-dialog
        #dialog="suiDialog"
        [class.nori-confirmation-host]="isConfirmation()"
        [class.nori-settings-host]="isSettings()"
        [class.nori-confirmation-expanded]="isConfirmation() && positionReady() && dialogs.detailsOpen()"
        [draggable]="!isConfirmation()"
        [position]="contentReady() ? dialogPosition() : 'top'"
        (keydown.escape)="handleEscape($event)"
        [class.nori-dialog-motion]="appearance.state().animations"
        style="--sui-dialog-radius: var(--nori-radius); --sui-dialog-border-color: var(--nori-border); --sui-dialog-shadow: none; --sui-dialog-enter-duration: 280ms; --sui-dialog-exit-duration: 180ms; --sui-dialog-motion-easing: cubic-bezier(0.22, 1, 0.36, 1)"
        [style.--sui-dialog-width]="isConfirmation() ? '24rem' : (content()?.width ?? 'var(--nori-dialog-width)')"
        [open]="dialogs.current() !== null && contentReady()"
        [ariaLabel]="content()?.title || (content()?.titleKey || 'common.confirm' | transloco)"
        [closeLabel]="'common.close' | transloco"
        [motion]="appearance.state().animations ? 'fade' : 'none'"
        [closeOnEscape]="!dialogs.pending()"
        [closeOnBackdrop]="!!content()?.closeOnBackdrop && !dialogs.pending()"
        (closed)="handleClosed(dialog)"
      >
        @if (content(); as current) {
          <header suiDialogHeader class="min-h-14" data-nori-dialog-entry>
            {{ current.titleKey ? (current.titleKey | transloco) : current.title }}
          </header>
        }
        <div #dialogBody suiDialogBody>
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
    }
  `,
})
export class DialogHostComponent {
  protected readonly dialogs: DialogService = inject(DialogService);
  protected readonly appearance: ApplicationState = inject(ApplicationState);
  private readonly injector: Injector = inject(Injector);

  private readonly dialogBody: Signal<ElementRef<HTMLDivElement> | undefined> =
    viewChild<ElementRef<HTMLDivElement>>('dialogBody');

  protected readonly content: WritableSignal<OpenDialog | null> = signal(null);

  protected readonly frames: Signal<readonly OpenDialog[]> = computed((): readonly OpenDialog[] => {
    const content: OpenDialog | null = this.content();
    return content ? [content] : [];
  });
  protected readonly isConfirmation: Signal<boolean> = computed((): boolean => this.content()?.component === ConfirmationDialog);

  protected readonly isSettings: Signal<boolean> = computed((): boolean => this.content()?.component === SettingsDialog);

  private readonly colourPosition: WritableSignal<DialogPosition> = signal('center');
  private sizeObserver: ResizeObserver | null = null;

  private readonly narrowViewport: Signal<BreakpointState | undefined> = toSignal(
    inject(BreakpointObserver).observe('(max-width: 832px)'),
  );
  protected readonly dialogPosition: Signal<DialogPosition> = computed(
    (): DialogPosition =>
      this.content()?.component === NodeColorsDialog
        ? this.colourPosition()
        : this.isConfirmation() && this.dialogs.detailsOpen() && this.narrowViewport()?.matches
          ? 'top'
          : 'center',
  );

  protected readonly contentReady: WritableSignal<boolean> = signal(false);
  protected readonly positionReady: WritableSignal<boolean> = signal(false);

  public constructor() {
    inject(DestroyRef).onDestroy((): void => this.sizeObserver?.disconnect());
    effect((): void => {
      const current: OpenDialog | null = this.dialogs.current();
      this.contentReady.set(false);
      this.positionReady.set(false);
      this.sizeObserver?.disconnect();
      this.colourPosition.set('center');
      if (!current) return;
      this.content.set(current);
      afterNextRender(
        (): void => {
          if (this.dialogs.current() !== current) return;
          this.contentReady.set(true);
          this.observeColourSize(current);
          afterNextRender(
            (): void => {
              if (this.dialogs.current() === current) this.positionReady.set(true);
            },
            { injector: this.injector },
          );
        },
        { injector: this.injector },
      );
    });
  }

  private observeColourSize(current: OpenDialog): void {
    if (current.component !== NodeColorsDialog) return;
    const body: HTMLDivElement | undefined = this.dialogBody()?.nativeElement;
    const dialog: HTMLDialogElement | null | undefined = body?.closest('dialog');
    if (!body || !dialog) return;
    this.sizeObserver = new ResizeObserver((): void => {
      if (!dialog.open || this.dialogs.current() !== current) return;
      const viewport: Window | null = dialog.ownerDocument.defaultView;
      if (!viewport) return;
      const bounds: DOMRect = dialog.getBoundingClientRect();
      const motionY: number = Number.parseFloat(viewport.getComputedStyle(dialog).translate.split(' ')[1] ?? '0') || 0;
      const position: DialogCoordinates = {
        left: Math.max(16, (viewport.innerWidth - bounds.width) / 2),
        top: Math.max(16, (viewport.innerHeight - bounds.height) / 2 - motionY),
      };
      const previous: DialogPosition = this.colourPosition();
      if (typeof previous === 'string' || previous.left !== position.left || previous.top !== position.top) {
        this.colourPosition.set(position);
      }
    });
    this.sizeObserver.observe(body);
    this.sizeObserver.observe(dialog.ownerDocument.documentElement);
  }

  protected handleEscape(event: Event): void {
    if (!this.dialogs.detailsOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.dialogs.detailsOpen.set(false);
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
