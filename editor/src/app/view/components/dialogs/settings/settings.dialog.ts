import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Button, SelectButton, type SelectButtonOption } from '@sushi-kit/angular';
import { APP_THEME, ApplicationState } from '../../../../states/application.state';
import { DialogService } from '../../../../services/dialog.service';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, SelectButton],
  templateUrl: './settings.dialog.html',
})
export class SettingsDialog {
  protected readonly appState: ApplicationState = inject(ApplicationState);
  protected readonly dialogs: DialogService = inject(DialogService);
  protected readonly themes: readonly SelectButtonOption[] = [
    { label: 'Light', value: APP_THEME.LIGHT },
    { label: 'Dark', value: APP_THEME.DARK },
  ];

  protected handleTheme(value: unknown): void {
    if (value === APP_THEME.LIGHT || value === APP_THEME.DARK) this.appState.setTheme(value);
  }
}
