import { EDITOR_SHORTCUTS, type ShortcutOverrides } from './definitions';

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

  public static fromEvent(event: KeyboardEvent): string | null {
    const key: string = event.key.toLowerCase();
    if (event.isComposing || ShortcutBindings.IGNORED_KEYS.has(key)) return null;
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

  public static display(binding: string): string {
    return binding.split('+').map(ShortcutBindings.keyLabel).join(' + ');
  }

  public static aria(binding: string): string {
    const keys: string[] = binding.split('+');
    const modifiers: readonly string[] = keys.includes('mod') ? ['control', 'meta'] : [''];
    return modifiers
      .map((modifier: string): string =>
        keys.map((key: string): string => ShortcutBindings.keyLabel(key === 'mod' ? modifier : key)).join('+'),
      )
      .join(' ');
  }

  public static restore(stored: unknown): ShortcutOverrides {
    if (!stored || typeof stored !== 'object') return {};
    const overrides: ShortcutOverrides = {};
    const used: Set<string> = new Set();
    for (const shortcut of EDITOR_SHORTCUTS) {
      const storedId: string | undefined = [shortcut.id, ...(shortcut.legacyIds ?? [])].find((id: string): boolean =>
        Object.hasOwn(stored, id),
      );
      const candidate: unknown = storedId ? Reflect.get(stored, storedId) : shortcut.key;
      const binding: string = ShortcutBindings.isValid(candidate) ? candidate : shortcut.key;
      if (used.has(binding)) return {};
      used.add(binding);
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
