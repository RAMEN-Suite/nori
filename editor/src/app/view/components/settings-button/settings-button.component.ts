import { ChangeDetectionStrategy, Component, inject, input, type InputSignal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideSettings } from '@lucide/angular';
import { Button, Tooltip } from '@sushi-kit/angular';
import { ShortcutService } from '../../../services/shortcut.service';
import { DialogService } from '../../../services/dialog.service';
import { SettingsDialog } from '../dialogs/settings/settings.dialog';

@Component({
  selector: 'app-settings-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, Tooltip, LucideSettings],
  templateUrl: './settings-button.component.html',
})
export class SettingsButtonComponent {
  protected readonly shortcuts: ShortcutService = inject(ShortcutService);
  private readonly dialogs: DialogService = inject(DialogService);

  public readonly shortcut: InputSignal<string | null> = input<string | null>(null);

  protected handleOpen(): void {
    this.dialogs.open(SettingsDialog, { headerKey: 'common.settings', width: '42rem' });
  }
}
