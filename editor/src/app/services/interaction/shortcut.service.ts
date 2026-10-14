import { computed, effect, inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import { ShortcutBindings } from '../../utils/shortcuts/bindings';
import {
  EDITOR_SHORTCUTS,
  SHORTCUT_DEFINITIONS,
  type ShortcutAction,
  type ShortcutOverrides,
} from '../../utils/shortcuts/definitions';
import { LocalStorageService } from '../persistence/local-storage.service';

/** Persists shortcut overrides and resolves actions through their active bindings. */
@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private readonly storage: LocalStorageService = inject(LocalStorageService);

  private static readonly STORAGE_KEY: string = 'shortcuts';
  private readonly overrides: WritableSignal<ShortcutOverrides> = signal({});

  private readonly actionsByBinding: Signal<ReadonlyMap<string, ShortcutAction>> = computed(
    () => new Map(EDITOR_SHORTCUTS.map((shortcut): [string, ShortcutAction] => [this.binding(shortcut.id), shortcut.id])),
  );

  public readonly bindings: Signal<ShortcutOverrides> = this.overrides.asReadonly();

  public constructor() {
    this.overrides.set(ShortcutBindings.restore(this.storage.get(ShortcutService.STORAGE_KEY)));
    effect((): void => this.storage.set(ShortcutService.STORAGE_KEY, this.bindings()));
  }

  public binding(action: ShortcutAction): string {
    return this.bindings()[action] ?? SHORTCUT_DEFINITIONS[action].key;
  }

  public display(action: ShortcutAction): string {
    return ShortcutBindings.display(this.binding(action));
  }

  public aria(action: ShortcutAction): string {
    return ShortcutBindings.aria(this.binding(action));
  }

  public resolve(event: KeyboardEvent): ShortcutAction | null {
    const binding: string | null = ShortcutBindings.fromEvent(event);
    return binding ? (this.actionsByBinding().get(binding) ?? null) : null;
  }

  public assign(action: ShortcutAction, binding: string): ShortcutAction | null {
    if (!ShortcutBindings.isValid(binding)) throw new TypeError('Invalid shortcut binding.');
    const conflict: ShortcutAction | undefined = this.actionsByBinding().get(binding);
    if (conflict && conflict !== action) return conflict;
    this.overrides.update((overrides: ShortcutOverrides): ShortcutOverrides => {
      const { [action]: _previous, ...remaining } = overrides;
      return binding === SHORTCUT_DEFINITIONS[action].key ? remaining : { ...remaining, [action]: binding };
    });
    return null;
  }

  public reset(): void {
    this.overrides.set({});
  }
}
