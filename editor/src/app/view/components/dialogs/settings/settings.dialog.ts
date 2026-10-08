import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Card, Radio, Toggle, List, ListItemTemplate } from '@sushi-kit/angular';
import { LucidePalette, LucidePlay, LucideSlidersHorizontal } from '@lucide/angular';
import { APP_THEMES, type AppTheme } from '../../../../models/Appearance';
import { ApplicationState } from '../../../../states/application.state';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Radio, Toggle, List, ListItemTemplate, LucidePalette, LucidePlay, LucideSlidersHorizontal],
  templateUrl: './settings.dialog.html',
  styleUrl: './settings.dialog.scss',
})
export class SettingsDialog {
  protected readonly appState: ApplicationState = inject(ApplicationState);

  protected readonly themes: readonly AppTheme[] = APP_THEMES;
  protected readonly animationSettings: readonly string[] = ['animations'];
}
