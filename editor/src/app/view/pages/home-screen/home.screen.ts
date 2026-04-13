import { Component, inject, OnInit } from '@angular/core';
import { WindowState } from '../../../states/window.state';
import { Button } from 'primeng/button';
import { environment } from '../../../../environments/environment';
import { RouterLink } from '@angular/router';
import { APP_THEME, ApplicationState } from '../../../states/application.state';

@Component({
  selector: 'app-home',
  imports: [Button, RouterLink],
  templateUrl: './home.screen.html',
  styleUrl: './home.screen.scss',
})
export class HomeScreen implements OnInit {
  protected readonly environment = environment;
  protected readonly APP_THEME = APP_THEME;

  protected readonly windowState: WindowState = inject(WindowState);
  protected readonly appState: ApplicationState = inject(ApplicationState);

  public ngOnInit(): void {
    this.windowState.setTitle('NORI - A Model Layering Tool', 'pi pi-home');
  }

  protected handleOpenRepository(): void {
    window.open(environment.repositoryURL, '_blank');
  }

  protected handleToggleTheme(): void {
    this.appState.setTheme(this.appState.state().theme === APP_THEME.DARK ? APP_THEME.LIGHT : APP_THEME.DARK);
  }
}
