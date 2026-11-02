import { computed, effect, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { ShortcutBindings } from '../../utils/shortcuts/bindings';
import {
  EDITOR_SHORTCUTS,
  SHORTCUT_DEFINITIONS,
  type ShortcutAction,
  type ShortcutDefinition,
  type ShortcutOverrides,
} from '../../utils/shortcuts/definitions';
import { LocalStorageService } from '../persistence/local-storage.service';

/** Persists shortcut overrides and resolves actions through their active bindings. */
@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private static readonly STORAGE_KEY: string = 'shortcuts';
  private readonly storage: LocalStorageService = inject(LocalStorageService);

  private readonly storedBindings: unknown = this.storage.get(ShortcutService.STORAGE_KEY);
  private readonly isMac: boolean = /mac|darwin|iphone|ipad/i.test(window.platform ?? navigator.platform);
  private readonly defaults: readonly ShortcutDefinition[] = EDITOR_SHORTCUTS.map(
    (shortcut: ShortcutDefinition): ShortcutDefinition =>
      shortcut.id === 'settings' && window.electron && !this.hasLegacySettingsConflict()
        ? { ...shortcut, key: 'mod+,' }
        : shortcut,
  );

  private readonly overrides: WritableSignal<ShortcutOverrides> = signal({});

  private readonly actionsByBinding: Signal<ReadonlyMap<string, ShortcutAction>> = computed(
    () =>
      new Map(
        this.defaults
          .filter((shortcut): boolean => this.available(shortcut.id))
          .map((shortcut): [string, ShortcutAction] => [this.binding(shortcut.id), shortcut.id])
          .filter(([binding]): boolean => !!binding),
      ),
  );

  public readonly bindings: Signal<ShortcutOverrides> = this.overrides.asReadonly();

  public constructor() {
    this.overrides.set(ShortcutBindings.restore(this.storedBindings, this.defaults));
    effect((): void => this.storage.set(ShortcutService.STORAGE_KEY, this.bindings()));
  }

  public binding(action: ShortcutAction): string {
    return this.bindings()[action] ?? this.defaultBinding(action);
  }

  public display(action: ShortcutAction): string {
    return ShortcutBindings.display(this.binding(action), this.isMac);
  }

  public hint(action: ShortcutAction): string {
    return this.binding(action) ? ` (${this.display(action)})` : '';
  }

  /** Move a binding only while the confirmed conflict still owns it. Empty overrides disable an action. */
  public reassign(action: ShortcutAction, binding: string, previousOwner: ShortcutAction): boolean {
    if (!ShortcutBindings.isValid(binding)) throw new TypeError('Invalid shortcut binding.');
    if (action === previousOwner || this.actionsByBinding().get(binding) !== previousOwner) return false;
    this.overrides.update(
      (overrides: ShortcutOverrides): ShortcutOverrides => ({
        ...overrides,
        [previousOwner]: '',
        [action]: binding,
      }),
    );
    return true;
  }

  public aria(action: ShortcutAction): string {
    return ShortcutBindings.aria(this.binding(action), this.isMac);
  }

  public available(action: ShortcutAction): boolean {
    // Cmd+Y belongs to browser History on macOS; Cmd+Shift+Z already provides Redo.
    return !(this.isMac && action === 'redoAlternative' && this.binding(action) === 'mod+y');
  }

  public fromEvent(event: KeyboardEvent): string | null {
    return ShortcutBindings.fromEvent(event, this.isMac);
  }

  public resolve(event: KeyboardEvent): ShortcutAction | null {
    const binding: string | null = this.fromEvent(event);
    return binding ? (this.actionsByBinding().get(binding) ?? null) : null;
  }

  public assign(action: ShortcutAction, binding: string): ShortcutAction | null {
    if (!ShortcutBindings.isValid(binding)) throw new TypeError('Invalid shortcut binding.');
    const conflict: ShortcutAction | undefined = this.actionsByBinding().get(binding);
    if (conflict && conflict !== action) return conflict;
    this.overrides.update((overrides: ShortcutOverrides): ShortcutOverrides => {
      const { [action]: _previous, ...remaining } = overrides;
      return binding === this.defaultBinding(action) ? remaining : { ...remaining, [action]: binding };
    });
    return null;
  }

  private hasLegacySettingsConflict(): boolean {
    const stored: unknown = this.storedBindings;
    return (
      !!stored && typeof stored === 'object' && !Object.hasOwn(stored, 'settings') && Object.values(stored).includes('mod+,')
    );
  }

  private defaultBinding(action: ShortcutAction): string {
    return (
      this.defaults.find((shortcut: ShortcutDefinition): boolean => shortcut.id === action)?.key ??
      SHORTCUT_DEFINITIONS[action].key
    );
  }

  public reset(): void {
    this.overrides.set({});
  }
}
