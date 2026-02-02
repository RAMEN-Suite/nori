import { Component, inject } from '@angular/core';
import { Menubar } from 'primeng/menubar';
import { Divider } from 'primeng/divider';
import { Button } from 'primeng/button';
import { APP_THEME, ApplicationState } from '../../../states/application.state';
import { BreadcrumbsComponent } from '../breadcrumb/breadcrumbs.component';
import { RouterLink } from '@angular/router';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'app-tool-bar',
  imports: [Menubar, Divider, Button, BreadcrumbsComponent, RouterLink, Tooltip],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
})
export class ToolBarComponent {
  protected readonly APP_THEME: typeof APP_THEME = APP_THEME;
  protected readonly appState: ApplicationState = inject(ApplicationState);

  protected handleToggleTheme(): void {
    const isDark: boolean = this.appState.state().theme === APP_THEME.DARK;
    this.appState.setTheme(isDark ? APP_THEME.LIGHT : APP_THEME.DARK);
  }
}
