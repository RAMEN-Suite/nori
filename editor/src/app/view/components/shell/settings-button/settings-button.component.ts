import { ChangeDetectionStrategy, Component, inject, input, type InputSignal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideSettings } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { ShortcutService } from '../../../../services/interaction/shortcut.service';
import { SettingsDialog } from '../../dialogs/settings/settings.dialog';

@Component({
  selector: 'nori-settings-button',
  host: { class: 'inline-flex shrink-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, TooltipDirective, LucideSettings],
  templateUrl: './settings-button.component.html',
})
export class SettingsButtonComponent {
  protected readonly shortcuts: ShortcutService = inject(ShortcutService);
  private readonly dialogs: DialogService = inject(DialogService);

  public readonly shortcut: InputSignal<string | null> = input<string | null>(null);

  protected handleOpen(): void {
    this.dialogs.open(SettingsDialog, { closeOnBackdrop: true, headerKey: 'common.settings', width: '42rem' });
  }
}
