import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  isDevMode,
  inject,
  provideAppInitializer,
} from '@angular/core';
import {
  provideRouter,
  withHashLocation,
  withRouterConfig,
  withViewTransitions,
  type ActivatedRouteSnapshot,
  type ViewTransitionInfo,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApplicationState } from './states/application.state';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { TranslationLoader } from './i18n/translation-loader';
import { routes } from './app.routes';
import { PARAMETERS } from './app-route-parameters';
import { Languages } from './i18n/languages';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideTransloco({
      config: {
        availableLangs: [...Languages.supported],
        defaultLang: Languages.defaultLanguage,
        fallbackLang: Languages.defaultLanguage,
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
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition, from, to }: ViewTransitionInfo): void => {
          const preferences: ApplicationState = inject(ApplicationState);
          if (!preferences.state().animations || (isWorkspaceRoute(from) && isWorkspaceRoute(to))) {
            transition.skipTransition();
            return;
          }

          if (isWorkspaceRoute(to)) transition.types.add('open-workspace');
        },
      }),
      ...(window.electron ? [withHashLocation()] : []),
    ),
  ],
};

function isWorkspaceRoute(route: ActivatedRouteSnapshot): boolean {
  return route.routeConfig?.path === `ws/:${PARAMETERS.PROJECT}` || route.children.some(isWorkspaceRoute);
}
