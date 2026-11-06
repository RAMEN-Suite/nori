import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type ElementRef,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { translateSignal, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideCheck,
  LucideX,
  LucideExternalLink,
  LucideMail,
  LucideUsers,
  LucideFolder,
  LucideLanguages,
  LucideNavigation,
  LucideNetwork,
  LucidePalette,
  LucidePanelsTopLeft,
  LucidePlay,
  LucideRotateCcw,
  LucideSlidersHorizontal,
} from '@lucide/angular';
import {
  AutoFocus,
  Dialog,
  DialogHeader,
  DialogBody,
  Card,
  Radio,
  Toggle,
  List,
  ListItemTemplate,
  Select,
  Tabs,
  Tab,
  Input,
  Button,
} from '@sushi-kit/angular';
import { ExternalLinkDirective } from '../../../../directives/external-link.directive';
import { ScrollOverflowDirective } from '../../../../directives/scroll-overflow.directive';
import { APP_THEMES, type AppTheme } from '../../../../models/Appearance';
import { Languages, type AppLanguage } from '../../../../i18n/languages';
import {
  EDITOR_SHORTCUTS,
  SHORTCUT_CATEGORIES,
  SHORTCUT_DEFINITIONS,
  type ShortcutAction,
  type ShortcutCategory,
  type ShortcutDefinition,
  type ShortcutGroup,
} from '../../../../utils/shortcuts/definitions';
import { ShortcutBindings } from '../../../../utils/shortcuts/bindings';
import { ShortcutService } from '../../../../services/interaction/shortcut.service';
import { ScrollHintsComponent } from '../../shared/scroll-hints/scroll-hints.component';
import { ConfirmationContentComponent } from '../confirmation/confirmation-content/confirmation-content.component';
import { environment } from '../../../../../environments/environment';
import { ApplicationState } from '../../../../states/application.state';

interface ShortcutConflict {
  readonly action: ShortcutAction;
  readonly binding: string;
  readonly previousOwner: ShortcutAction;
  readonly shortcut: string;
  readonly previousLabel: string;
  readonly nextLabel: string;
}

@Component({
  selector: 'nori-settings-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AutoFocus,
    ConfirmationContentComponent,
    Dialog,
    DialogHeader,
    DialogBody,
    LucideCheck,
    LucideX,
    ExternalLinkDirective,
    LucideExternalLink,
    LucideMail,
    LucideUsers,
    LucideRotateCcw,
    TranslocoDirective,
    ScrollOverflowDirective,
    ScrollHintsComponent,
    Card,
    Radio,
    Toggle,
    List,
    ListItemTemplate,
    Select,
    Input,
    Button,
    Tabs,
    Tab,
    LucidePalette,
    LucidePlay,
    LucideSlidersHorizontal,
    LucideLanguages,
    LucidePanelsTopLeft,
    LucideNetwork,
    LucideFolder,
    LucideNavigation,
  ],
  templateUrl: './settings.dialog.html',
  styleUrl: './settings.dialog.scss',
})
export class SettingsDialog {
  protected readonly appState: ApplicationState = inject(ApplicationState);
  protected readonly shortcutService: ShortcutService = inject(ShortcutService);
  private readonly translations: TranslocoService = inject(TranslocoService);

  private readonly languageLabels: Signal<string[]> = translateSignal(
    Languages.options.map((language: AppLanguage): string => `settings.languageOptions.${language}`),
  );
  protected readonly languageOptions: Signal<readonly { value: AppLanguage; label: string }[]> = computed(() => {
    const labels: string[] = this.languageLabels();
    return Languages.options.map((language: AppLanguage, index: number): { value: AppLanguage; label: string } => ({
      value: language,
      label: labels[index] ?? language,
    }));
  });

  protected readonly schemaURL: string = environment.schemaURL;
  protected readonly repositoryURL: string = environment.repositoryURL;
  protected readonly coreURL: string = environment.coreURL;

  protected readonly themes: readonly AppTheme[] = APP_THEMES;
  protected readonly animationSettings: readonly string[] = ['animations'];
  protected readonly shortcutGroups: readonly ShortcutGroup[] = SHORTCUT_CATEGORIES.map(
    (category: ShortcutCategory): ShortcutGroup => ({
      category,
      shortcuts: EDITOR_SHORTCUTS.filter(
        (shortcut: ShortcutDefinition): boolean => shortcut.category === category && this.shortcutService.available(shortcut.id),
      ),
    }),
  );
  protected readonly recording: WritableSignal<ShortcutAction | null> = signal(null);
  protected readonly shortcutError: WritableSignal<{ action: ShortcutAction; message: string } | null> = signal(null);

  private readonly shortcutErrorElement: Signal<ElementRef<HTMLElement> | undefined> = viewChild('shortcutErrorMessage');

  public constructor() {
    afterRenderEffect((): void => {
      if (this.shortcutError()) this.shortcutErrorElement()?.nativeElement.scrollIntoView({ block: 'nearest' });
    });
  }

  protected readonly shortcutConflict: WritableSignal<ShortcutConflict | null> = signal(null);
  protected readonly isConflictOpen: WritableSignal<boolean> = signal(false);

  protected confirmReassignment(): void {
    const conflict: ShortcutConflict | null = this.shortcutConflict();
    if (!conflict) return;
    if (!this.shortcutService.reassign(conflict.action, conflict.binding, conflict.previousOwner)) return;
    this.isConflictOpen.set(false);
  }

  protected finishConflict(): void {
    this.isConflictOpen.set(false);
    this.shortcutConflict.set(null);
  }

  protected startRecording(action: ShortcutAction): void {
    if (this.shortcutError()?.action !== action) this.shortcutError.set(null);
    this.recording.set(action);
  }

  protected handleShortcut(event: KeyboardEvent, action: ShortcutAction): void {
    if (event.key === 'Tab') return;
    if (this.recording() !== action) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      this.recording.set(null);
      this.shortcutError.set(null);
      return;
    }
    if (event.repeat || event.isComposing) return;
    const binding: string | null = this.shortcutService.fromEvent(event);
    if (!binding) return;
    if (!ShortcutBindings.isValid(binding)) {
      this.shortcutError.set({ action, message: this.translations.translate('settings.unsupportedShortcut') });
      return;
    }
    const conflict: ShortcutAction | null = this.shortcutService.assign(action, binding);
    if (conflict) {
      this.presentConflict(action, binding, conflict);
      return;
    }
    this.recording.set(null);
    this.shortcutError.set(null);
  }

  private presentConflict(action: ShortcutAction, binding: string, previousOwner: ShortcutAction): void {
    const label: (id: ShortcutAction) => string = (id: ShortcutAction): string =>
      this.translations.translate(SHORTCUT_DEFINITIONS[id].label);
    this.recording.set(null);
    this.shortcutError.set(null);
    this.shortcutConflict.set({
      action,
      binding,
      previousOwner,
      shortcut: this.shortcutService.display(previousOwner),
      previousLabel: label(previousOwner),
      nextLabel: label(action),
    });
    this.isConflictOpen.set(true);
  }

  protected handleResetShortcuts(): void {
    this.shortcutService.reset();
    this.recording.set(null);
    this.shortcutError.set(null);
  }

  protected handleLanguage(value: unknown): void {
    const language: AppLanguage | undefined = Languages.options.find((candidate: AppLanguage): boolean => candidate === value);
    if (language) this.appState.setLanguage(language);
  }
}
