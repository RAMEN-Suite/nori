import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  isDevMode,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter, withHashLocation, withRouterConfig, withViewTransitions } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApplicationState } from './states/application.state';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { TranslationLoader } from './i18n/translation-loader';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideTransloco({
      config: {
        availableLangs: ['de', 'en'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslationLoader,
    }),
    provideAppInitializer(() => {
      const preferences: ApplicationState = inject(ApplicationState);
      return firstValueFrom(inject(TranslocoService).load(preferences.language()));
    }),
    provideRouter(
      routes,
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withViewTransitions({ skipInitialTransition: true }),
      ...(window.electron ? [withHashLocation()] : []),
    ),
  ],
};
