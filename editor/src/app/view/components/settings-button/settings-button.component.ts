import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideSettings } from '@lucide/angular';
import { Button } from '@sushi-kit/angular';
import { DialogService } from '../../../services/dialog.service';
import { SettingsDialog } from '../dialogs/settings/settings.dialog';

@Component({
  selector: 'app-settings-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, Button, LucideSettings],
  templateUrl: './settings-button.component.html',
})
export class SettingsButtonComponent {
  private readonly dialogs: DialogService = inject(DialogService);

  protected handleOpen(): void {
    this.dialogs.open(SettingsDialog, { headerKey: 'common.settings' });
  }
}
