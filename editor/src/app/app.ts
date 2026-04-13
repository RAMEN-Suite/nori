import { Component, DOCUMENT, effect, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TitleBarComponent } from './view/components/window/title-bar/title-bar.component';
import { RouterOutlet } from '@angular/router';
import { APP_THEME, ApplicationState } from './states/application.state';

@Component({
  selector: 'app-root',
  imports: [ButtonModule, TitleBarComponent, RouterOutlet],
  providers: [],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly editorState: ApplicationState = inject(ApplicationState);
  private readonly document: Document = inject(DOCUMENT);
  protected readonly isElectronRuntime: boolean = !!window.electron;

  constructor() {
    const titleBarHeight: string = this.isElectronRuntime ? '36px' : '0px';
    this.document.documentElement.style.setProperty('--p-title-bar-h', titleBarHeight);

    effect((): void => {
      const html: HTMLElement = this.document.documentElement;
      const isDark: boolean = this.editorState.state().theme === APP_THEME.DARK;
      html.classList.toggle('dark', isDark);
    });
  }
}
