import '@angular/compiler';
import type {} from '../editor/src/types/electron';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createEnvironmentInjector,
  Injector,
  ɵChangeDetectionScheduler,
  ɵEffectScheduler,
  type EnvironmentInjector,
} from '@angular/core';
import { editorTestModule } from './testing/editor-test-module.mts';
import type * as ShortcutsModule from '../editor/src/app/services/interaction/shortcut.service';
import type * as StorageModule from '../editor/src/app/services/persistence/local-storage.service';
import type * as BindingsModule from '../editor/src/app/utils/shortcuts/bindings';

type Runtime = typeof ShortcutsModule & typeof StorageModule & typeof BindingsModule;
const runtime: Runtime = await editorTestModule<Runtime>([
  './editor/src/app/services/interaction/shortcut.service',
  './editor/src/app/services/persistence/local-storage.service',
  './editor/src/app/utils/shortcuts/bindings',
]);

interface ShortcutHarness {
  readonly service: ShortcutsModule.ShortcutService;
  destroy(): void;
}

function create(stored: unknown = null): ShortcutHarness {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { platform: 'MacIntel' } });
  const injector: EnvironmentInjector = createEnvironmentInjector(
    [
      { provide: ɵChangeDetectionScheduler, useValue: { notify: (): void => undefined } },
      {
        provide: ɵEffectScheduler,
        useValue: { add: (): void => undefined, schedule: (): void => undefined, remove: (): void => undefined },
      },
      runtime.ShortcutService,
      { provide: runtime.LocalStorageService, useValue: { get: (): unknown => stored, set: (): void => undefined } },
    ],
    Injector.NULL as EnvironmentInjector,
  );
  return { service: injector.get(runtime.ShortcutService), destroy: (): void => injector.destroy() };
}

await test('conflicts require confirmation; reassignment survives reload without duplicate owners', (): void => {
  const first: ShortcutHarness = create();
  assert.equal(first.service.assign('settings', 'r'), 'refinements');
  assert.equal(first.service.binding('settings'), ',');
  assert.equal(first.service.binding('refinements'), 'r');
  assert.equal(first.service.reassign('settings', 'r', 'baseNodes'), false);
  assert.equal(first.service.reassign('settings', 'r', 'refinements'), true);
  assert.equal(first.service.binding('settings'), 'r');
  assert.equal(first.service.binding('refinements'), '');
  assert.equal(first.service.hint('refinements'), '');
  const second: ShortcutHarness = create(first.service.bindings());
  assert.equal(second.service.binding('settings'), 'r');
  assert.equal(second.service.binding('refinements'), '');
  const event: KeyboardEvent = {
    key: 'r',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    getModifierState: (): boolean => false,
  } as unknown as KeyboardEvent;
  assert.equal(second.service.resolve(event), 'settings');
  second.service.reset();
  assert.equal(second.service.resolve(event), 'refinements');
  assert.equal(second.service.binding('settings'), ',');
  first.destroy();
  second.destroy();
});

await test('empty bindings can coexist; shortcut display and accessibility remain platform specific', (): void => {
  const bindings: typeof BindingsModule.ShortcutBindings = runtime.ShortcutBindings;
  assert.deepEqual(bindings.restore({ settings: '', refinements: '' }), { settings: '', refinements: '' });
  assert.equal(bindings.display('mod+shift+z', true), '⇧\u202f⌘\u202fZ');
  assert.equal(bindings.display('mod+shift+z'), 'Ctrl + Shift + Z');
  assert.equal(bindings.aria('mod+shift+z', true), 'Meta+Shift+Z');
});
