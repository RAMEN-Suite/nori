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
import { NotificationService } from './services/interaction/notification.service';
import { PropertyEditingService } from './services/workspace/editing/property-editing.service';
import { DialogService } from './services/interaction/dialog.service';
import { NotificationsComponent } from './view/components/shell/notifications/notifications.component';
import { ProjectService } from './services/projects/project.service';
import { ApplicationState } from './states/application.state';
import { DialogHostComponent } from './view/components/shell/dialog-host/dialog-host.component';
import { ActionFeedbackComponent } from './view/components/shell/action-feedback/action-feedback.component';
import { TitleBarComponent } from './view/components/shell/title-bar/title-bar.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-root',
  imports: [ActionFeedbackComponent, DialogHostComponent, TitleBarComponent, RouterOutlet, NotificationsComponent],
  templateUrl: './app.html',
})
export class App {
  protected readonly propertyEditing: PropertyEditingService = inject(PropertyEditingService);
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly notifications: NotificationService = inject(NotificationService);
  protected readonly editorState: ApplicationState = inject(ApplicationState);
  private readonly document: Document = inject(DOCUMENT);
  private readonly injector: Injector = inject(Injector);

  protected readonly isElectronRuntime: boolean = !!window.electron;

  public constructor() {
    const titleBarHeight: string = this.isElectronRuntime ? '36px' : '0px';
    this.document.documentElement.style.setProperty('--title-bar-height', titleBarHeight);

    effect((): void => {
      const error: string | null = this.projects.error();
      if (!error) return;

      untracked((): void => {
        this.notifications.show({
          message: error,
          status: 'error',
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
