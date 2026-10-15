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
  | 'exportSvg'
  | 'exportPng'
  | 'settings'
  | 'undo'
  | 'redo'
  | 'redoAlternative'
  | 'back';

export type ShortcutCategory = 'views' | 'graph' | 'project' | 'navigation';
export const SHORTCUT_CATEGORIES: readonly ShortcutCategory[] = ['views', 'graph', 'project', 'navigation'];

export interface ShortcutDefinition {
  readonly id: ShortcutAction;
  readonly category: ShortcutCategory;
  readonly key: string;
  readonly label: string;
  readonly legacyIds?: readonly string[];
}

export interface ShortcutGroup {
  readonly category: ShortcutCategory;
  readonly shortcuts: readonly ShortcutDefinition[];
}

export type ShortcutOverrides = Partial<Record<ShortcutAction, string>>;

export const SHORTCUT_DEFINITIONS: Readonly<Record<ShortcutAction, Omit<ShortcutDefinition, 'id'>>> = {
  refinements: { category: 'views', key: 'r', label: 'editor.refinements' },
  baseNodes: { category: 'views', key: 'b', label: 'editor.baseNodes' },
  levels: { category: 'views', key: 'm', label: 'editor.levels' },
  inspector: { category: 'views', key: 'i', label: 'editor.inspector' },
  select: { category: 'graph', key: 'v', label: 'editor.selectTool' },
  connect: { category: 'graph', key: 'l', label: 'editor.drawConnection' },
  erase: { category: 'graph', key: 'e', label: 'editor.eraseElements', legacyIds: ['disconnect'] },
  fit: { category: 'graph', key: 'f', label: 'editor.fit' },
  reset: { category: 'graph', key: 'shift+r', label: 'editor.reset' },
  colours: { category: 'graph', key: 'c', label: 'editor.colours' },
  project: { category: 'project', key: 'p', label: 'editor.editProject' },
  validation: { category: 'project', key: 'shift+v', label: 'editor.validationTitle' },
  export: { category: 'project', key: 'mod+shift+e', label: 'editor.export' },
  exportSvg: { category: 'project', key: 'shift+s', label: 'editor.exportSvg' },
  exportPng: { category: 'project', key: 'shift+p', label: 'editor.exportPng' },
  settings: { category: 'navigation', key: ',', label: 'common.settings' },
  undo: { category: 'graph', key: 'mod+z', label: 'editor.undoRelation' },
  redo: { category: 'graph', key: 'mod+shift+z', label: 'editor.redoRelation' },
  redoAlternative: { category: 'graph', key: 'mod+y', label: 'editor.redoRelationAlternative' },
  back: { category: 'navigation', key: 'alt+arrowleft', label: 'common.back' },
};

export const EDITOR_SHORTCUTS: readonly ShortcutDefinition[] = Object.keys(SHORTCUT_DEFINITIONS)
  .filter(isShortcutAction)
  .map((id: ShortcutAction): ShortcutDefinition => ({ id, ...SHORTCUT_DEFINITIONS[id] }));

export function isShortcutAction(value: string): value is ShortcutAction {
  return Object.hasOwn(SHORTCUT_DEFINITIONS, value);
}
