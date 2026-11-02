import '@angular/compiler';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { createEnvironmentInjector, Injector, type EnvironmentInjector } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { buildSync } from 'esbuild';
import type { ActionFeedback, ActionFeedbackOptions } from '../editor/src/app/services/interaction/action-feedback.service';
import type * as ActionModule from '../editor/src/app/services/interaction/action-feedback.service';
import type * as StatusModule from '../editor/src/app/services/interaction/notification.service';

type FeedbackModule = typeof ActionModule & typeof StatusModule;
mkdirSync('.angular', { recursive: true });
const directory: string = mkdtempSync('.angular/feedback-check-');
const target: string = join(directory, 'feedback.mjs');
buildSync({
  stdin: {
    contents: `export * from './editor/src/app/services/interaction/action-feedback.service';
      export * from './editor/src/app/services/interaction/notification.service';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  outfile: target,
});
const { ActionFeedbackService, NotificationService }: FeedbackModule = (await import(
  pathToFileURL(target).href
)) as FeedbackModule;
process.on('exit', (): void => rmSync(directory, { recursive: true, force: true }));

function setup(): {
  injector: EnvironmentInjector;
  actions: InstanceType<FeedbackModule['ActionFeedbackService']>;
  statuses: InstanceType<FeedbackModule['NotificationService']>;
} {
  const injector: EnvironmentInjector = createEnvironmentInjector(
    [
      ActionFeedbackService,
      NotificationService,
      { provide: TranslocoService, useValue: { translate: (key: string): string => key } },
    ],
    Injector.NULL as EnvironmentInjector,
  );
  return { injector, actions: injector.get(ActionFeedbackService), statuses: injector.get(NotificationService) };
}

function current(actions: InstanceType<FeedbackModule['ActionFeedbackService']>): ActionFeedback {
  const action: ActionFeedback | null = actions.current();
  assert.ok(action);
  return action;
}

function review(overrides: Partial<ActionFeedbackOptions> = {}): ActionFeedbackOptions {
  return {
    owner: 'model-validation',
    title: 'Review',
    description: 'Findings',
    severity: 'error',
    label: 'View',
    run: (): void => undefined,
    cancel: (): void => undefined,
    ...overrides,
  };
}

await test('only statuses expire; actions survive time, status replacement and inspection', async (context: TestContext): Promise<void> => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { injector, actions, statuses }: ReturnType<typeof setup> = setup();
  context.after((): void => injector.destroy());
  const id: string = actions.publish(review());
  const first: string = statuses.show({ status: 'error', message: 'First' });
  const second: string = statuses.show({ status: 'success', message: 'Second' });
  statuses.dismiss(first);
  assert.equal(statuses.current()?.id, second);
  context.mock.timers.tick(60_000);
  assert.equal(statuses.current(), null);
  assert.equal(actions.current()?.id, id);
  const action: ActionFeedback = current(actions);
  await actions.run(action);
  assert.equal(actions.current()?.id, id, 'inspection does not complete the action');
  actions.release(id);
  assert.equal(actions.current(), null);
});

await test('a workflow occupies the single slot; review returns after explicit workflow completion', (): void => {
  const { injector, actions }: ReturnType<typeof setup> = setup();
  try {
    const id: string = actions.publish(review());
    const workflow: string = actions.publish(review({ owner: 'removal-review', title: 'Resume deletion' }));
    assert.equal(actions.current()?.id, workflow);
    assert.equal(actions.publish(review({ description: 'Updated findings' })), id);
    assert.equal(actions.current()?.id, workflow);
    actions.release(workflow);
    assert.equal(actions.current()?.description, 'Updated findings');
    actions.cancel(current(actions));
    assert.equal(actions.current(), null);
  } finally {
    injector.destroy();
  }
});

await test('pending work cannot run twice or be cancelled; failure becomes status and keeps the action', async (): Promise<void> => {
  const { injector, actions, statuses }: ReturnType<typeof setup> = setup();
  let finish: (() => void) | undefined;
  let runs: number = 0;
  const wait: Promise<void> = new Promise((resolve): void => {
    finish = resolve;
  });
  actions.publish(
    review({
      run: async (): Promise<void> => {
        runs++;
        await wait;
        throw new Error('Retry');
      },
    }),
  );
  const action: ActionFeedback = current(actions);
  const running: Promise<void> = actions.run(action);
  assert.equal(actions.pending(), true);
  await actions.run(action);
  actions.cancel(action);
  assert.equal(runs, 1);
  assert.equal(actions.current()?.id, action.id);
  finish?.();
  await running;
  assert.equal(actions.pending(), false);
  assert.equal(statuses.current()?.message, 'Retry');
  assert.equal(actions.current()?.id, action.id);
  injector.destroy();
});
