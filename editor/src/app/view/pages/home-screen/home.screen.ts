import { Component, inject, OnInit, ChangeDetectionStrategy, signal, type WritableSignal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { WindowState } from '../../../states/window.state';
import { Button, Card, Message } from '@sushi-kit/angular';
import { LucideFolderOpen, LucidePlus, LucideSettings, LucideArrowUpRight } from '@lucide/angular';
import { environment } from '../../../../environments/environment';
import { RouterLink } from '@angular/router';
import { DialogService } from '../../../services/dialog.service';
import { StorageService } from '../../../services/storage.service';
import { NavigationService } from '../../../services/navigation.service';
import { BrandIllustrationComponent } from '../../components/brand-illustration/brand-illustration.component';
import { ExternalLinkDirective } from '../../../directives/external-link.directive';
import { SettingsDialog } from '../../components/dialogs/settings/settings.dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-home',
  imports: [
    TranslocoDirective,
    Button,
    Card,
    Message,
    BrandIllustrationComponent,
    ExternalLinkDirective,
    RouterLink,
    LucideFolderOpen,
    LucidePlus,
    LucideSettings,
    LucideArrowUpRight,
  ],
  templateUrl: './home.screen.html',
  styleUrl: './home.screen.scss',
})
export class HomeScreen implements OnInit {
  protected readonly environment: typeof environment = environment;

  private readonly windowState: WindowState = inject(WindowState);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly dialogs: DialogService = inject(DialogService);
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

  protected handleSettings(): void {
    this.dialogs.open(SettingsDialog, { headerKey: 'common.settings' });
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
