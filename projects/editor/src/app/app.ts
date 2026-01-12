import { Component, DOCUMENT, effect, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TitleBarComponent } from './components/bars/title-bar/title-bar.component';
import { RouterOutlet } from '@angular/router';
import { EDITOR_THEME, EditorState } from './states/editor.state';

@Component({
  selector: 'app-root',
  imports: [ButtonModule, TitleBarComponent, RouterOutlet],
  providers: [],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly editorState: EditorState = inject(EditorState);
  private readonly document: Document = inject(DOCUMENT);
  protected readonly isElectronRuntime: boolean = !!window.electron;

  constructor() {
    effect((): void => {
      const html: HTMLElement = this.document.documentElement;
      const isDark: boolean = this.editorState.state().theme === EDITOR_THEME.DARK;
      html.classList.toggle('dark', isDark);
    });
  }
}
