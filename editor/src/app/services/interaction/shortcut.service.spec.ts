import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { LocalStorageService } from '../persistence/local-storage.service';
import { ShortcutService } from './shortcut.service';

it('requires explicit reassignment and restores the resulting shortcut from storage', (): void => {
  let stored: unknown = null;
  const provider: { provide: typeof LocalStorageService; useValue: object } = {
    provide: LocalStorageService,
    useValue: {
      get: (): unknown => stored,
      set: (_key: string, value: unknown): void => {
        stored = value;
      },
    },
  };
  TestBed.configureTestingModule({ providers: [provider] });
  const shortcuts: ShortcutService = TestBed.inject(ShortcutService);
  expect(shortcuts.assign('settings', 'r')).toBe('refinements');
  expect(shortcuts.binding('settings')).toBe(',');
  expect(shortcuts.reassign('settings', 'r', 'refinements')).toBe(true);
  TestBed.tick();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provider] });
  const restored: ShortcutService = TestBed.inject(ShortcutService);
  expect(restored.resolve(new KeyboardEvent('keydown', { key: 'r' }))).toBe('settings');
  expect(restored.binding('refinements')).toBe('');
});
