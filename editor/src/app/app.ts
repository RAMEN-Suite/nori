import { ChangeDetectionStrategy, Component, DOCUMENT, effect, inject, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Toast, ToastService } from '@sushi-kit/angular';
import { ProjectService } from './services/projects/project.service';
import { ApplicationState } from './states/application.state';
import { DialogHostComponent } from './view/components/shell/dialog-host/dialog-host.component';
import { RunningActionNotificationComponent } from './view/components/shell/running-action-notification/running-action-notification.component';
import { VersionFooterComponent } from './view/components/shell/version-footer/version-footer.component';
import { TitleBarComponent } from './view/components/shell/title-bar/title-bar.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-root',
  imports: [
    RunningActionNotificationComponent,
    DialogHostComponent,
    TitleBarComponent,
    RouterOutlet,
    VersionFooterComponent,
    Toast,
    TranslocoPipe,
  ],
  templateUrl: './app.html',
})
export class App {
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly toasts: ToastService = inject(ToastService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  protected readonly editorState: ApplicationState = inject(ApplicationState);
  private readonly document: Document = inject(DOCUMENT);

  private errorToastId: string | null = null;
  protected readonly isElectronRuntime: boolean = !!window.electron;

  public constructor() {
    const titleBarHeight: string = this.isElectronRuntime ? '36px' : '0px';
    this.document.documentElement.style.setProperty('--title-bar-height', titleBarHeight);

    effect((): void => {
      const error: string | null = this.projects.error();
      if (!error) return;

      untracked((): void => {
        if (this.errorToastId) this.toasts.dismiss(this.errorToastId);
        this.errorToastId = this.toasts.show({
          title: this.translations.translate('common.actionFailed'),
          message: error,
          severity: 'error',
          variant: 'soft',
        });
        this.projects.error.set(null);
      });
    });

    effect((): void => {
      const html: HTMLElement = this.document.documentElement;
      html.classList.toggle('dark', this.editorState.theme().colourScheme === 'dark');
      html.dataset['theme'] = this.editorState.theme().sushiTheme;
      html.dataset['motion'] = this.editorState.state().animations ? 'on' : 'off';
    });
  }
}
