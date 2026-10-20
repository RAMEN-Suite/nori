import { ChangeDetectionStrategy, Component, computed, inject, signal, type Signal, type WritableSignal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideExternalLink,
  LucideMail,
  LucideUsers,
  LucideFolder,
  LucideLanguages,
  LucideNavigation,
  LucideNetwork,
  LucidePalette,
  LucidePanelsTopLeft,
  LucidePlay,
  LucideRotateCcw,
  LucideSlidersHorizontal,
} from '@lucide/angular';
import { Card, Radio, Toggle, List, ListItemTemplate, Select, Tabs, Tab, Input, Button } from '@sushi-kit/angular';
import { ExternalLinkDirective } from '../../../../directives/external-link.directive';
import { ScrollOverflowDirective } from '../../../../directives/scroll-overflow.directive';
import { APP_THEMES, type AppTheme } from '../../../../models/Appearance';
import { Languages, type AppLanguage } from '../../../../i18n/languages';
import {
  EDITOR_SHORTCUTS,
  SHORTCUT_CATEGORIES,
  type ShortcutAction,
  type ShortcutCategory,
  type ShortcutDefinition,
  type ShortcutGroup,
} from '../../../../utils/shortcuts/definitions';
import { ShortcutBindings } from '../../../../utils/shortcuts/bindings';
import { ShortcutService } from '../../../../services/interaction/shortcut.service';
import { ScrollHintsComponent } from '../../shared/scroll-hints/scroll-hints.component';
import { environment } from '../../../../../environments/environment';
import { ApplicationState } from '../../../../states/application.state';

@Component({
  selector: 'nori-settings-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ExternalLinkDirective,
    LucideExternalLink,
    LucideMail,
    LucideUsers,
    LucideRotateCcw,
    TranslocoDirective,
    ScrollOverflowDirective,
    ScrollHintsComponent,
    Card,
    Radio,
    Toggle,
    List,
    ListItemTemplate,
    Select,
    Input,
    Button,
    Tabs,
    Tab,
    LucidePalette,
    LucidePlay,
    LucideSlidersHorizontal,
    LucideLanguages,
    LucidePanelsTopLeft,
    LucideNetwork,
    LucideFolder,
    LucideNavigation,
  ],
  templateUrl: './settings.dialog.html',
  styleUrl: './settings.dialog.scss',
})
export class SettingsDialog {
  protected readonly appState: ApplicationState = inject(ApplicationState);
  protected readonly shortcutService: ShortcutService = inject(ShortcutService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  protected readonly languageOptions: Signal<readonly { value: AppLanguage; label: string }[]> = computed(() => {
    this.appState.language();
    return Languages.options.map((language: AppLanguage): { value: AppLanguage; label: string } => ({
      value: language,
      label: this.translations.translate(`settings.languageOptions.${language}`),
    }));
  });

  protected readonly schemaURL: string = environment.schemaURL;
  protected readonly repositoryURL: string = environment.repositoryURL;
  protected readonly coreURL: string = environment.coreURL;

  protected readonly themes: readonly AppTheme[] = APP_THEMES;
  protected readonly animationSettings: readonly string[] = ['animations'];
  protected readonly shortcutGroups: readonly ShortcutGroup[] = SHORTCUT_CATEGORIES.map(
    (category: ShortcutCategory): ShortcutGroup => ({
      category,
      shortcuts: EDITOR_SHORTCUTS.filter((shortcut: ShortcutDefinition): boolean => shortcut.category === category),
    }),
  );
  protected readonly recording: WritableSignal<ShortcutAction | null> = signal(null);
  protected readonly shortcutError: WritableSignal<string | null> = signal(null);

  protected handleShortcut(event: KeyboardEvent, action: ShortcutAction): void {
    if (event.key === 'Tab') return;
    if (this.recording() !== action) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      this.recording.set(null);
      this.shortcutError.set(null);
      return;
    }
    if (event.repeat || event.isComposing) return;
    const binding: string | null = ShortcutBindings.fromEvent(event);
    if (!binding) return;
    if (!ShortcutBindings.isValid(binding)) {
      this.shortcutError.set(this.translations.translate('settings.unsupportedShortcut'));
      return;
    }
    const conflict: ShortcutAction | null = this.shortcutService.assign(action, binding);
    if (conflict) {
      const label: string = EDITOR_SHORTCUTS.find((shortcut): boolean => shortcut.id === conflict)?.label ?? '';
      const actionLabel: string = this.translations.translate(label);
      this.shortcutError.set(this.translations.translate('settings.shortcutConflict', { action: actionLabel }));
      return;
    }
    this.recording.set(null);
    this.shortcutError.set(null);
  }

  protected handleResetShortcuts(): void {
    this.shortcutService.reset();
    this.recording.set(null);
    this.shortcutError.set(null);
  }

  protected handleLanguage(value: unknown): void {
    const language: AppLanguage | undefined = Languages.options.find((candidate: AppLanguage): boolean => candidate === value);
    if (language) this.appState.setLanguage(language);
  }
}
