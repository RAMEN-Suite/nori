import '@angular/compiler';
import type {} from '../editor/src/types/electron';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createEnvironmentInjector,
  ElementRef,
  Injector,
  runInInjectionContext,
  ɵChangeDetectionScheduler,
  ɵEffectScheduler,
  type EnvironmentInjector,
  type InputSignal,
} from '@angular/core';
import { SIGNAL } from '@angular/core/primitives/signals';
import { TranslocoService } from '@jsverse/transloco';
import { DataTypes, type Attribute } from '@ramen-suite/core/model';
import { editorTestModule } from './testing/editor-test-module.mts';
import type * as FormModule from '../editor/src/app/view/components/workspace/property-editor/property-form/property-form.component';
import type * as WorkspaceModule from '../editor/src/app/services/workspace/workspace.service';
import type * as ProjectsModule from '../editor/src/app/services/projects/project.service';
import type * as NotificationsModule from '../editor/src/app/services/interaction/notification.service';

type Runtime = typeof FormModule & typeof WorkspaceModule & typeof ProjectsModule & typeof NotificationsModule;
const runtime: Runtime = await editorTestModule<Runtime>([
  './editor/src/app/view/components/workspace/property-editor/property-form/property-form.component',
  './editor/src/app/services/workspace/workspace.service',
  './editor/src/app/services/projects/project.service',
  './editor/src/app/services/interaction/notification.service',
]);

interface ScheduledEffect {
  readonly dirty: boolean;
  run(): void;
}

class Effects {
  private readonly entries: Set<ScheduledEffect> = new Set();
  public add(effect: ScheduledEffect): void {
    this.entries.add(effect);
  }
  public schedule(): void {
    /* flush explicitly in these synchronous checks */
  }
  public remove(effect: ScheduledEffect): void {
    this.entries.delete(effect);
  }
  public flush(): void {
    for (let pass: number = 0; pass < 20; pass++) {
      const dirty: ScheduledEffect[] = [...this.entries].filter((effect: ScheduledEffect): boolean => effect.dirty);
      if (!dirty.length) return;
      dirty.forEach((effect: ScheduledEffect): void => effect.run());
    }
    assert.fail('Form effects did not settle.');
  }
}

class Form extends runtime.PropertyFormComponent {
  public rename(value: string): void {
    this.name.set(value);
  }
  public readonlyValue(value: boolean): void {
    this.handleOption('readonly', value);
  }
  public list(value: boolean): void {
    this.handleOption('multiple', value);
  }
  public minimum(value: number): void {
    this.handleMinimum(value);
  }
}

function setInput<T>(input: InputSignal<T>, value: T): void {
  const node: InputSignal<T>[typeof SIGNAL] = input[SIGNAL];
  node.applyValueToInputSignal(node, value);
}

function create(): { form: Form; effects: Effects; destroy: () => void } {
  const effects: Effects = new Effects();
  const injector: EnvironmentInjector = createEnvironmentInjector(
    [
      { provide: ɵChangeDetectionScheduler, useValue: { notify: (): void => undefined } },
      { provide: ɵEffectScheduler, useValue: effects },
      { provide: runtime.WorkspaceService, useValue: {} },
      { provide: runtime.ProjectService, useValue: {} },
      { provide: runtime.NotificationService, useValue: {} },
      { provide: TranslocoService, useValue: {} },
      { provide: ElementRef, useValue: new ElementRef({ querySelector: (): null => null }) },
    ],
    Injector.NULL as EnvironmentInjector,
  );
  const form: Form = runInInjectionContext(injector, (): Form => new Form());
  const attribute: Attribute = {
    id: 'property',
    name: 'title',
    typeId: DataTypes.String,
    bounds: { lowerBound: 0, upperBound: 1 },
    constraints: [],
  };
  setInput(form.currentAttribute, attribute);
  effects.flush();
  return { form, effects, destroy: (): void => injector.destroy() };
}

await test('property previews react to name, list bounds and usage without revision counters', (): void => {
  const { form, effects, destroy }: ReturnType<typeof create> = create();
  try {
    assert.equal(form.preview()?.name, 'title');
    form.rename('label');
    assert.equal(form.preview()?.name, 'label');
    assert.equal(form.hasChanges(), true);
    form.list(true);
    form.minimum(2);
    form.readonlyValue(true);
    assert.deepEqual(form.preview()?.bounds, { lowerBound: 2, upperBound: -1 });
    assert.equal(form.preview()?.isReadOnly, true);
    form.reset();
    effects.flush();
    assert.equal(form.hasChanges(), false);
    assert.equal(form.preview()?.name, 'title');
  } finally {
    destroy();
  }
});

await test('autosave observes signal edits once and does not save initial or reset values', (): void => {
  const { form, effects, destroy }: ReturnType<typeof create> = create();
  try {
    let requests: number = 0;
    form.submitRequested.subscribe((): void => {
      requests++;
    });
    setInput(form.autoSave, true);
    effects.flush();
    assert.equal(requests, 0);
    form.readonlyValue(true);
    effects.flush();
    assert.equal(requests, 1);
    effects.flush();
    assert.equal(requests, 1);
    form.rename('label');
    effects.flush();
    assert.equal(requests, 2);
    form.reset();
    effects.flush();
    assert.equal(requests, 2);
  } finally {
    destroy();
  }
});
