import { Component, DOCUMENT, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { DialogHostComponent } from './view/components/dialogs/host/dialog-host.component';
import { TitleBarComponent } from './view/components/window/title-bar/title-bar.component';
import { RouterOutlet } from '@angular/router';
import { StorageService } from './services/storage.service';
import { ApplicationState } from './states/application.state';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [DialogHostComponent, TitleBarComponent, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly storage: StorageService = inject(StorageService);
  private readonly editorState: ApplicationState = inject(ApplicationState);
  private readonly document: Document = inject(DOCUMENT);
  protected readonly isElectronRuntime: boolean = !!window.electron;

  public constructor() {
    const titleBarHeight: string = this.isElectronRuntime ? '36px' : '0px';
    this.document.documentElement.style.setProperty('--title-bar-height', titleBarHeight);

    effect((): void => {
      const html: HTMLElement = this.document.documentElement;
      html.classList.toggle('dark', this.editorState.theme().colourScheme === 'dark');
      html.dataset['theme'] = this.editorState.theme().sushiTheme;
      html.dataset['motion'] = this.editorState.state().animations ? 'on' : 'off';
    });
  }
}
