import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { SuitePreset } from '../styles/suite-preset';
import { PLATFORM, platformFactory } from './tokens/platform.token';
import { ElectronService } from './services/electron.service';

export const appConfig: ApplicationConfig = {
  providers: [
    providePrimeNG({
      theme: { preset: SuitePreset, options: { darkModeSelector: '.dark' } },
      ripple: true,
    }),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),

    { provide: PLATFORM, useFactory: platformFactory, deps: [ElectronService] },
  ],
};
