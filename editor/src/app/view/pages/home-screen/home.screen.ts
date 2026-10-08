import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { WindowState } from '../../../states/window.state';
import { Button } from '@sushi-kit/angular';
import { environment } from '../../../../environments/environment';
import { RouterLink } from '@angular/router';
import { APP_THEME, ApplicationState } from '../../../states/application.state';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-home',
  imports: [Button, RouterLink],
  templateUrl: './home.screen.html',
  styleUrl: './home.screen.scss',
})
export class HomeScreen implements OnInit {
  protected readonly environment: typeof environment = environment;
  protected readonly APP_THEME: typeof APP_THEME = APP_THEME;

  protected readonly windowState: WindowState = inject(WindowState);
  protected readonly appState: ApplicationState = inject(ApplicationState);

  public ngOnInit(): void {
    this.windowState.setTitle('Nori - A Model Layering Tool');
  }

  protected handleOpenRepository(): void {
    if (window.electron) void window.electron.openExternal(environment.repositoryURL);
    else window.open(environment.repositoryURL, '_blank', 'noopener,noreferrer');
  }

  protected handleToggleTheme(): void {
    this.appState.setTheme(this.appState.state().theme === APP_THEME.DARK ? APP_THEME.LIGHT : APP_THEME.DARK);
  }
}
