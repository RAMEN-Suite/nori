export type ShortcutAction =
  | 'refinements'
  | 'baseNodes'
  | 'levels'
  | 'inspector'
  | 'select'
  | 'connect'
  | 'erase'
  | 'fit'
  | 'reset'
  | 'colours'
  | 'project'
  | 'validation'
  | 'export'
  | 'settings'
  | 'undo'
  | 'redo'
  | 'redoAlternative'
  | 'back';

export type ShortcutCategory = 'views' | 'graph' | 'project' | 'navigation';

export const SHORTCUT_CATEGORIES: readonly ShortcutCategory[] = ['views', 'graph', 'project', 'navigation'];

export interface ShortcutGroup {
  readonly category: ShortcutCategory;
  readonly shortcuts: readonly ShortcutDefinition[];
}

export interface ShortcutDefinition {
  readonly category: ShortcutCategory;
  readonly id: ShortcutAction;
  readonly key: string;
  readonly label: string;
}

export const EDITOR_SHORTCUTS: readonly ShortcutDefinition[] = [
  { id: 'refinements', category: 'views', key: 'r', label: 'editor.refinements' },
  { id: 'baseNodes', category: 'views', key: 'b', label: 'editor.baseNodes' },
  { id: 'levels', category: 'views', key: 'm', label: 'editor.levels' },
  { id: 'inspector', category: 'views', key: 'i', label: 'editor.inspector' },
  { id: 'select', category: 'graph', key: 'v', label: 'editor.selectTool' },
  { id: 'connect', category: 'graph', key: 'l', label: 'editor.drawConnection' },
  { id: 'erase', category: 'graph', key: 'e', label: 'editor.eraseElements' },
  { id: 'fit', category: 'graph', key: 'f', label: 'editor.fit' },
  { id: 'reset', category: 'graph', key: 'shift+r', label: 'editor.reset' },
  { id: 'colours', category: 'graph', key: 'c', label: 'editor.colours' },
  { id: 'project', category: 'project', key: 'p', label: 'editor.editProject' },
  { id: 'validation', category: 'project', key: 'shift+v', label: 'editor.validationTitle' },
  { id: 'export', category: 'project', key: 'mod+shift+e', label: 'editor.export' },
  { id: 'settings', category: 'navigation', key: ',', label: 'common.settings' },
  { id: 'undo', category: 'graph', key: 'mod+z', label: 'editor.undoRelation' },
  { id: 'redo', category: 'graph', key: 'mod+shift+z', label: 'editor.redoRelation' },
  { id: 'redoAlternative', category: 'graph', key: 'mod+y', label: 'editor.redoRelationAlternative' },
  { id: 'back', category: 'navigation', key: 'alt+arrowleft', label: 'common.back' },
];

export type ShortcutOverrides = Partial<Record<ShortcutAction, string>>;

export function shortcutFromEvent(event: KeyboardEvent): string | null {
  const key: string = event.key.toLowerCase();
  if (['control', 'meta', 'alt', 'shift', 'escape', 'tab', 'dead', 'unidentified'].includes(key)) return null;
  return [event.ctrlKey || event.metaKey ? 'mod' : '', event.altKey ? 'alt' : '', event.shiftKey ? 'shift' : '', key]
    .filter(Boolean)
    .join('+');
}

export function isShortcutBinding(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(mod\+)?(alt\+)?(shift\+)?([a-z0-9,.;/\x5b\]\x27=-]|f\d{1,2}|arrow(left|right|up|down)|enter|backspace|delete|home|end|pageup|pagedown)$/.test(
      value,
    )
  );
}
