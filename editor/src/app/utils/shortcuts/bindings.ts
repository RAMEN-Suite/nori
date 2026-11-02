import { EDITOR_SHORTCUTS, type ShortcutOverrides, type ShortcutDefinition } from './definitions';

/** Encodes keyboard events and formats or restores canonical shortcut bindings. */
export class ShortcutBindings {
  private static readonly MODIFIERS: readonly string[] = ['mod', 'alt', 'shift'];
  private static readonly IGNORED_KEYS: ReadonlySet<string> = new Set([
    'control',
    'meta',
    'alt',
    'shift',
    'escape',
    'tab',
    'dead',
    'unidentified',
  ]);
  private static readonly KEY_LABELS: Readonly<Record<string, string>> = {
    mod: 'Ctrl / Cmd',
    shift: 'Shift',
    alt: 'Alt',
    control: 'Control',
    meta: 'Meta',
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

  public static fromEvent(event: KeyboardEvent, isMac: boolean = false): string | null {
    const key: string = event.key.toLowerCase();
    if (event.isComposing || ShortcutBindings.IGNORED_KEYS.has(key) || event.getModifierState('AltGraph')) return null;
    // The primary command modifier is Cmd on macOS and Ctrl elsewhere.
    if (isMac ? event.ctrlKey : event.metaKey) return null;
    return [event.ctrlKey || event.metaKey ? 'mod' : '', event.altKey ? 'alt' : '', event.shiftKey ? 'shift' : '', key]
      .filter(Boolean)
      .join('+');
  }

  public static isValid(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const parts: string[] = value.split('+');
    const key: string | undefined = parts.pop();
    if (!key || !ShortcutBindings.isKey(key)) return false;
    return parts.every((part: string, index: number): boolean => {
      const position: number = ShortcutBindings.MODIFIERS.indexOf(part);
      return position >= 0 && (index === 0 || position > ShortcutBindings.MODIFIERS.indexOf(parts[index - 1] ?? ''));
    });
  }

  public static display(binding: string, isMac: boolean = false): string {
    const keys: string[] = binding.split('+');
    if (isMac) {
      const symbols: Readonly<Record<string, string>> = { mod: '⌘', alt: '⌥', shift: '⇧' };
      return [
        ...['alt', 'shift', 'mod'].filter((key: string): boolean => keys.includes(key)),
        ...keys.filter((key: string): boolean => !Object.hasOwn(symbols, key)),
      ]
        .map((key: string): string => symbols[key] ?? ShortcutBindings.keyLabel(key))
        .join('\u202f');
    }
    return keys.map((key: string): string => (key === 'mod' ? 'Ctrl' : ShortcutBindings.keyLabel(key))).join(' + ');
  }

  public static aria(binding: string, isMac: boolean = false): string {
    return binding
      .split('+')
      .map((key: string): string => ShortcutBindings.keyLabel(key === 'mod' ? (isMac ? 'meta' : 'control') : key))
      .join('+');
  }

  public static restore(stored: unknown, definitions: readonly ShortcutDefinition[] = EDITOR_SHORTCUTS): ShortcutOverrides {
    if (!stored || typeof stored !== 'object') return {};
    const overrides: ShortcutOverrides = {};
    const used: Set<string> = new Set();
    for (const shortcut of definitions) {
      const storedId: string | undefined = [shortcut.id, ...(shortcut.legacyIds ?? [])].find((id: string): boolean =>
        Object.hasOwn(stored, id),
      );
      const candidate: unknown = storedId ? Reflect.get(stored, storedId) : shortcut.key;
      const binding: string = candidate === '' || ShortcutBindings.isValid(candidate) ? candidate : shortcut.key;
      if (used.has(binding)) return {};
      if (binding) used.add(binding);
      if (binding !== shortcut.key) overrides[shortcut.id] = binding;
    }
    return overrides;
  }

  private static keyLabel(key: string): string {
    return ShortcutBindings.KEY_LABELS[key] ?? key.toUpperCase();
  }

  private static isKey(key: string): boolean {
    return (
      /^[a-z0-9,.;/'=[\]-]$/.test(key) ||
      /^f(?:[1-9]|1\d|2[0-4])$/.test(key) ||
      (Object.hasOwn(ShortcutBindings.KEY_LABELS, key) &&
        !ShortcutBindings.MODIFIERS.includes(key) &&
        !ShortcutBindings.IGNORED_KEYS.has(key))
    );
  }
}
