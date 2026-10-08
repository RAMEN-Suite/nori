import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { Card, Radio, Toggle, List, ListItemTemplate, Select } from '@sushi-kit/angular';
import { LucidePalette, LucidePlay, LucideSlidersHorizontal, LucideLanguages } from '@lucide/angular';
import { APP_THEMES, type AppTheme } from '../../../../models/Appearance';
import { APP_LANGUAGES, type AppLanguage } from '../../../../models/Language';
import { ApplicationState } from '../../../../states/application.state';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoDirective,
    Card,
    Radio,
    Toggle,
    List,
    ListItemTemplate,
    Select,
    LucidePalette,
    LucidePlay,
    LucideSlidersHorizontal,
    LucideLanguages,
  ],
  templateUrl: './settings.dialog.html',
  styleUrl: './settings.dialog.scss',
})
export class SettingsDialog {
  protected readonly appState: ApplicationState = inject(ApplicationState);

  protected readonly themes: readonly AppTheme[] = APP_THEMES;
  protected readonly animationSettings: readonly string[] = ['animations'];

  protected handleLanguage(value: unknown): void {
    const language: AppLanguage | undefined = APP_LANGUAGES.find((candidate: AppLanguage): boolean => candidate === value);
    if (language) this.appState.setLanguage(language);
  }
}
