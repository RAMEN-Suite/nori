import {
  computed,
  DOCUMENT,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Languages, type AppLanguage, type TranslationLanguage } from '../i18n/languages';
import { LocalStorageService } from '../services/persistence/local-storage.service';
import { APP_THEME, APP_THEMES, DEFAULT_THEME, type AppTheme } from '../models/Appearance';

interface State {
  readonly theme: APP_THEME;
  readonly animations: boolean;
  readonly language: AppLanguage;
}

const defaultState: State = {
  theme: DEFAULT_THEME.id,
  language: 'system',
  animations: true,
};

/** Restores and applies appearance, language and animation preferences. */
@Injectable({ providedIn: 'root' })
export class ApplicationState {
  private readonly storageService: LocalStorageService = inject(LocalStorageService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly document: Document = inject(DOCUMENT);

  private static readonly STORAGE_KEY: string = 'application';
  private readonly systemLanguage: WritableSignal<TranslationLanguage> = signal(Languages.resolve(navigator.languages));
  private readonly preferences: WritableSignal<State> = signal(defaultState);
  private readonly colourPreference: MediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly isSystemDark: WritableSignal<boolean> = signal(this.colourPreference.matches);
  private readonly motionPreference: MediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly isSystemMotionReduced: WritableSignal<boolean> = signal(this.motionPreference.matches);
  public readonly isMotionEnabled: Signal<boolean> = computed(
    (): boolean => this.state().animations && !this.isSystemMotionReduced(),
  );
  public readonly state: Signal<State> = this.preferences.asReadonly();

  public readonly language: Signal<TranslationLanguage> = computed((): TranslationLanguage => {
    const language: AppLanguage = this.state().language;
    return language === 'system' ? this.systemLanguage() : language;
  });
  public readonly theme: Signal<AppTheme> = computed((): AppTheme => {
    const selected: AppTheme = APP_THEMES.find((theme: AppTheme): boolean => theme.id === this.state().theme) ?? DEFAULT_THEME;
    if (selected.id !== APP_THEME.SYSTEM) return selected;

    return (
      APP_THEMES.find((theme: AppTheme): boolean => theme.id === (this.isSystemDark() ? APP_THEME.DARK : APP_THEME.LIGHT)) ??
      DEFAULT_THEME
    );
  });

  public constructor() {
    const updateSystemMotion: (event: MediaQueryListEvent) => void = (event: MediaQueryListEvent): void =>
      this.isSystemMotionReduced.set(event.matches);
    this.motionPreference.addEventListener('change', updateSystemMotion);
    inject(DestroyRef).onDestroy((): void => this.motionPreference.removeEventListener('change', updateSystemMotion));

    const updateSystemTheme: (event: MediaQueryListEvent) => void = (event: MediaQueryListEvent): void =>
      this.isSystemDark.set(event.matches);
    this.colourPreference.addEventListener('change', updateSystemTheme);
    inject(DestroyRef).onDestroy((): void => this.colourPreference.removeEventListener('change', updateSystemTheme));

    const updateSystemLanguage: () => void = (): void => this.systemLanguage.set(Languages.resolve(navigator.languages));
    window.addEventListener('languagechange', updateSystemLanguage);
    inject(DestroyRef).onDestroy((): void => window.removeEventListener('languagechange', updateSystemLanguage));

    this.preferences.set(this.restorePreferences());
    this.translations.setActiveLang(this.language());
    effect((): void => {
      this.translations.setActiveLang(this.language());
      this.document.documentElement.lang = this.language();
    });
    effect((): void => this.storageService.set(ApplicationState.STORAGE_KEY, this.state()));
  }

  public setTheme(theme: APP_THEME): void {
    this.preferences.update((state: State): State => ({ ...state, theme }));
  }

  public setAnimations(animations: boolean): void {
    this.preferences.update((state: State): State => ({ ...state, animations }));
  }

  public setLanguage(language: AppLanguage): void {
    this.preferences.update((state: State): State => ({ ...state, language }));
  }

  private restorePreferences(): State {
    const stored: unknown = this.storageService.get(ApplicationState.STORAGE_KEY);
    if (typeof stored !== 'object' || stored === null) return defaultState;

    const theme: AppTheme | undefined =
      'theme' in stored ? APP_THEMES.find((candidate: AppTheme): boolean => candidate.id === stored.theme) : undefined;
    const language: AppLanguage | undefined =
      'language' in stored
        ? Languages.options.find((candidate: AppLanguage): boolean => candidate === stored.language)
        : undefined;
    const animations: unknown = 'animations' in stored ? stored.animations : undefined;

    return {
      language: language ?? defaultState.language,
      theme: theme?.id ?? defaultState.theme,
      animations: typeof animations === 'boolean' ? animations : defaultState.animations,
    };
  }
}
