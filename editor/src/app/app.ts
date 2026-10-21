import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  effect,
  inject,
  Injector,
  untracked,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { ToastService } from '@sushi-kit/angular';
import { PropertyEditingService } from './services/workspace/editing/property-editing.service';
import { DialogService } from './services/interaction/dialog.service';
import { NotificationsComponent } from './view/components/shell/notifications/notifications.component';
import { ProjectService } from './services/projects/project.service';
import { ApplicationState } from './states/application.state';
import { DialogHostComponent } from './view/components/shell/dialog-host/dialog-host.component';
import { RunningActionNotificationComponent } from './view/components/shell/running-action-notification/running-action-notification.component';
import { TitleBarComponent } from './view/components/shell/title-bar/title-bar.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-root',
  imports: [RunningActionNotificationComponent, DialogHostComponent, TitleBarComponent, RouterOutlet, NotificationsComponent],
  templateUrl: './app.html',
})
export class App {
  protected readonly propertyEditing: PropertyEditingService = inject(PropertyEditingService);
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly toasts: ToastService = inject(ToastService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  protected readonly editorState: ApplicationState = inject(ApplicationState);
  private readonly document: Document = inject(DOCUMENT);
  private readonly injector: Injector = inject(Injector);

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
          duration: 0,
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

  protected handleViewReady(): void {
    afterNextRender((): void => window.electron?.ready(), { injector: this.injector });
  }
}
