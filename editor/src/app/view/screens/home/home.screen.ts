import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  type OnInit,
  signal,
  type WritableSignal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideArrowUpRight, LucideBoxes, LucideCodeXml, LucideFileBraces, LucideFolderOpen, LucidePlus } from '@lucide/angular';
import { Button, Card, Message } from '@sushi-kit/angular';
import { environment } from '../../../../environments/environment';
import { ExternalLinkDirective } from '../../../directives/external-link.directive';
import { NavigationService } from '../../../services/interaction/navigation.service';
import { ProjectService } from '../../../services/projects/project.service';
import { ProjectImportError } from '../../../utils/project-import';
import { ApplicationState } from '../../../states/application.state';
import { LogoIntroComponent } from '../../components/projects/logo-intro/logo-intro.component';
import { WindowState } from '../../../states/window.state';
import { BrandIllustrationComponent } from '../../components/projects/brand-illustration/brand-illustration.component';
import { EntryBackdropComponent } from '../../components/projects/entry-backdrop/entry-backdrop.component';
import { SettingsButtonComponent } from '../../components/shell/settings-button/settings-button.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-home',
  imports: [
    RouterLink,
    TranslocoDirective,
    Button,
    Card,
    Message,
    LucideArrowUpRight,
    LucideBoxes,
    LucideCodeXml,
    LucideFileBraces,
    LucideFolderOpen,
    LucidePlus,
    ExternalLinkDirective,
    BrandIllustrationComponent,
    LogoIntroComponent,
    EntryBackdropComponent,
    SettingsButtonComponent,
  ],
  templateUrl: './home.screen.html',
  styleUrls: ['../../components/projects/styles/entry-shell.scss', './home.screen.scss'],
})
export class HomeScreen implements OnInit {
  private readonly router: Router = inject(Router);
  private readonly application: ApplicationState = inject(ApplicationState);
  private readonly reducedMotion: MediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly windowState: WindowState = inject(WindowState);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly navigation: NavigationService = inject(NavigationService);

  protected readonly introVisible: WritableSignal<boolean> = signal(
    this.router.lastSuccessfulNavigation() === null && this.application.state().animations && !this.reducedMotion.matches,
  );
  protected readonly playLogoIntro: boolean = this.introVisible();
  protected readonly introPlaying: WritableSignal<boolean> = signal(this.introVisible());
  protected readonly importing: WritableSignal<boolean> = signal(false);
  protected readonly importError: WritableSignal<string | null> = signal(null);
  protected readonly resources: readonly {
    readonly icon: 'schema' | 'suite' | 'core';
    readonly label: string;
    readonly url: string;
  }[] = [
    { icon: 'schema', label: 'RAMEN Schema', url: environment.schemaURL },
    { icon: 'suite', label: 'RAMEN Suite', url: environment.repositoryURL },
    { icon: 'core', label: 'RAMEN Core', url: environment.coreURL },
  ];

  public constructor() {
    const skipIntro: () => void = (): void => {
      if (this.reducedMotion.matches) this.introVisible.set(false);
    };
    this.reducedMotion.addEventListener('change', skipIntro);
    inject(DestroyRef).onDestroy((): void => this.reducedMotion.removeEventListener('change', skipIntro));
    effect((): void => {
      if (!this.application.state().animations) this.introVisible.set(false);
    });
  }

  protected finishIntro(): void {
    this.introVisible.set(false);
  }

  public ngOnInit(): void {
    this.windowState.setTitle('');
  }

  protected async handleImport(input: HTMLInputElement): Promise<void> {
    const file: File | undefined = input.files?.[0];
    input.value = '';
    if (!file || this.importing()) return;

    this.importing.set(true);
    this.importError.set(null);

    try {
      const contents: unknown = JSON.parse(await file.text());
      const projectId: string = await this.projects.importProject(contents);
      await this.navigation.navigateToProject(projectId);
    } catch (error: unknown) {
      this.importError.set(
        error instanceof ProjectImportError
          ? this.translations.translate('home.importFileError', { message: error.message })
          : this.translations.translate('home.importError'),
      );
    } finally {
      this.importing.set(false);
    }
  }
}
