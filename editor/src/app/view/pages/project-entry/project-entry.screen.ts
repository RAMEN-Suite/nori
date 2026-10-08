import { ChangeDetectionStrategy, Component, DOCUMENT, inject, OnInit, signal, type WritableSignal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { Button } from '@sushi-kit/angular';
import { LucideArrowLeft, LucideSettings } from '@lucide/angular';
import { environment } from '../../../../environments/environment';
import { ApplicationState } from '../../../states/application.state';
import { WindowState } from '../../../states/window.state';
import { DialogService } from '../../../services/dialog.service';
import { SettingsDialog } from '../../components/dialogs/settings/settings.dialog';
import { ProjectCreateComponent } from '../../components/project-create/project-create.component';
import { ProjectOpenComponent } from '../../components/project-open/project-open.component';

/** Keeps each card mounted when the alternative is revealed, preserving in-progress input. */
@Component({
  selector: 'app-project-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslocoDirective,
    Button,
    LucideArrowLeft,
    LucideSettings,
    ProjectCreateComponent,
    ProjectOpenComponent,
  ],
  templateUrl: './project-entry.screen.html',
  styleUrls: ['../project-entry.scss', './project-entry.screen.scss'],
})
export class ProjectEntryScreen implements OnInit {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly windows: WindowState = inject(WindowState);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly preferences: ApplicationState = inject(ApplicationState);
  private readonly document: Document = inject(DOCUMENT);

  protected readonly environment: typeof environment = environment;
  protected readonly initial: 'create' | 'open' = this.route.snapshot.routeConfig?.path === 'open' ? 'open' : 'create';
  protected readonly expanded: WritableSignal<boolean> = signal(false);
  protected readonly busy: WritableSignal<boolean> = signal(false);

  public ngOnInit(): void {
    this.windows.setTitleKey(
      this.initial === 'create' ? 'create.windowTitle' : 'open.title',
      this.initial === 'create' ? 'folder-plus' : 'folder-open',
    );
  }

  protected handleSettings(): void {
    this.dialogs.open(SettingsDialog, { headerKey: 'common.settings' });
  }

  protected handleReveal(): void {
    if (this.expanded() || this.busy()) return;
    if (!this.preferences.state().animations || !('startViewTransition' in this.document)) {
      this.expanded.set(true);
      return;
    }

    const transition: ViewTransition = this.document.startViewTransition((): void => this.expanded.set(true));
    if ('types' in transition) transition.types.add(this.initial === 'create' ? 'add-open-card' : 'add-create-card');
  }
}
