import { Component, DOCUMENT, effect, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { WindowPanelComponent } from './components/panels/window-panel/window-panel.component';
import { RouterOutlet } from '@angular/router';
import {
  EDITOR_THEME,
  EditorPanelState,
} from './components/panels/editor-panel/editor-panel.state';

@Component({
  selector: 'app-root',
  imports: [ButtonModule, WindowPanelComponent, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly editorPanelState: EditorPanelState = inject(EditorPanelState);
  private readonly document: Document = inject(DOCUMENT);

  protected readonly isElectronRuntime: boolean = !!window.electron;

  constructor() {
    effect((): void => {
      const html: HTMLElement = document.documentElement;
      const isDark: boolean = this.editorPanelState.state().theme === EDITOR_THEME.DARK;

      html.classList.toggle('dark', isDark);
    });
  }
}
