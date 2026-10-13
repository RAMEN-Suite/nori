import { Injectable, effect, inject, signal, type Signal, type WritableSignal } from '@angular/core';
import {
  EDITOR_SHORTCUTS,
  isShortcutBinding,
  shortcutFromEvent,
  type ShortcutAction,
  type ShortcutOverrides,
} from '../models/Shortcut';
import { LocalStorageService } from './local-storage.service';

@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private readonly storage: LocalStorageService = inject(LocalStorageService);
  private readonly overrides: WritableSignal<ShortcutOverrides> = signal({});

  public readonly bindings: Signal<ShortcutOverrides> = this.overrides.asReadonly();

  public constructor() {
    this.overrides.set(this.restore());
    effect((): void => this.storage.set('shortcuts', this.bindings()));
  }

  public binding(action: ShortcutAction): string {
    return this.bindings()[action] ?? EDITOR_SHORTCUTS.find((shortcut): boolean => shortcut.id === action)?.key ?? '';
  }

  public display(action: ShortcutAction): string {
    return this.binding(action)
      .split('+')
      .map((key: string): string => (key === 'mod' ? 'Ctrl / Cmd' : this.keyLabel(key)))
      .join(' + ');
  }

  public aria(action: ShortcutAction): string {
    const binding: string = this.binding(action);
    const combinations: readonly string[] = binding.includes('mod+')
      ? ['Control', 'Meta'].map((modifier: string): string => binding.replace('mod', modifier))
      : [binding];
    return combinations
      .map((combination: string): string =>
        combination
          .split('+')
          .map((key: string): string => this.keyLabel(key))
          .join('+'),
      )
      .join(' ');
  }

  public resolve(event: KeyboardEvent): ShortcutAction | null {
    const binding: string | null = shortcutFromEvent(event);
    return EDITOR_SHORTCUTS.find((shortcut): boolean => this.binding(shortcut.id) === binding)?.id ?? null;
  }

  public assign(action: ShortcutAction, binding: string): ShortcutAction | null {
    const conflict: ShortcutAction | undefined = EDITOR_SHORTCUTS.find(
      (shortcut): boolean => shortcut.id !== action && this.binding(shortcut.id) === binding,
    )?.id;
    if (conflict) return conflict;
    this.overrides.update((overrides: ShortcutOverrides): ShortcutOverrides => ({ ...overrides, [action]: binding }));
    return null;
  }

  public reset(): void {
    this.overrides.set({});
  }

  private keyLabel(key: string): string {
    const labels: Readonly<Record<string, string>> = {
      shift: 'Shift',
      alt: 'Alt',
      arrowleft: 'ArrowLeft',
      arrowright: 'ArrowRight',
      arrowup: 'ArrowUp',
      arrowdown: 'ArrowDown',
      enter: 'Enter',
      backspace: 'Backspace',
      delete: 'Delete',
      home: 'Home',
      end: 'End',
      pageup: 'PageUp',
      pagedown: 'PageDown',
    };
    return labels[key] ?? (key.length === 1 || /^f\d+$/.test(key) ? key.toUpperCase() : key);
  }

  private restore(): ShortcutOverrides {
    const stored: unknown = this.storage.get('shortcuts');
    if (!stored || typeof stored !== 'object') return {};
    const overrides: ShortcutOverrides = {};
    const used: Set<string> = new Set();
    for (const shortcut of EDITOR_SHORTCUTS) {
      const storedId: string = shortcut.id === 'erase' && !('erase' in stored) ? 'disconnect' : shortcut.id;
      const candidate: unknown = storedId in stored ? Reflect.get(stored, storedId) : shortcut.key;
      const binding: string = isShortcutBinding(candidate) ? candidate : shortcut.key;
      if (used.has(binding)) return {};
      used.add(binding);
      if (binding !== shortcut.key) overrides[shortcut.id] = binding;
    }
    return overrides;
  }
}
