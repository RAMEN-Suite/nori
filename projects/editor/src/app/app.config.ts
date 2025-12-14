import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { SuitePreset } from '../styles/suite-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    providePrimeNG({ theme: { preset: SuitePreset }, ripple: true }),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
  ],
};
