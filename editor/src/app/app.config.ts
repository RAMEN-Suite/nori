import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      ...(window.electron ? [withHashLocation()] : []),
    ),
  ],
};
