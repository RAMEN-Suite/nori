import { ChangeDetectionStrategy, Component, inject, OnInit, signal, type WritableSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideArrowUpRight, LucideFolderOpen, LucidePlus } from '@lucide/angular';
import { Button, Card, Message } from '@sushi-kit/angular';
import { environment } from '../../../../environments/environment';
import { ExternalLinkDirective } from '../../../directives/external-link.directive';
import { NavigationService } from '../../../services/navigation.service';
import { StorageService } from '../../../services/storage.service';
import { WindowState } from '../../../states/window.state';
import { BrandIllustrationComponent } from '../../components/brand-illustration/brand-illustration.component';
import { SettingsButtonComponent } from '../../components/settings-button/settings-button.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-home',
  imports: [
    RouterLink,
    TranslocoDirective,
    Button,
    Card,
    Message,
    LucideArrowUpRight,
    LucideFolderOpen,
    LucidePlus,
    ExternalLinkDirective,
    BrandIllustrationComponent,
    SettingsButtonComponent,
  ],
  templateUrl: './home.screen.html',
  styleUrls: ['../entry-shell.scss', './home.screen.scss'],
})
export class HomeScreen implements OnInit {
  private readonly windowState: WindowState = inject(WindowState);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly storage: StorageService = inject(StorageService);
  private readonly navigation: NavigationService = inject(NavigationService);

  protected readonly importing: WritableSignal<boolean> = signal(false);
  protected readonly importError: WritableSignal<string | null> = signal(null);

  protected readonly resources: readonly { readonly label: string; readonly url: string }[] = [
    { label: 'RAMEN Schema', url: environment.schemaURL },
    { label: 'RAMEN Suite', url: environment.repositoryURL },
    { label: 'RAMEN Core', url: environment.coreURL },
  ];

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
      const projectId: string = await this.storage.importRecord(contents);
      await this.navigation.navigateToProject(projectId);
    } catch {
      this.importError.set(this.translations.translate('home.importError'));
    } finally {
      this.importing.set(false);
    }
  }
}
