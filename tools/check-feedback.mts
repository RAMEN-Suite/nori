import '@angular/compiler';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createEnvironmentInjector, Injector, type EnvironmentInjector } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { RamenModel, RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import { editorTestModule } from './testing/editor-test-module.mts';
import type { ActionFeedback, ActionFeedbackOptions } from '../editor/src/app/services/interaction/action-feedback.service';
import type * as ActionModule from '../editor/src/app/services/interaction/action-feedback.service';
import type * as InteractionModule from '../editor/src/app/services/interaction/interaction-state.service';
import type * as CommandsModule from '../editor/src/app/services/workspace/model/workspace-actions.service';
import type * as ProjectModule from '../editor/src/app/services/projects/project.service';
import type * as StoreModule from '../editor/src/app/states/workspace.store';
import type * as HistoryModule from '../editor/src/app/services/workspace/model/model-history.service';
import type * as BlockedModule from '../editor/src/app/models/InteractionBlockedError';
import type * as StatusModule from '../editor/src/app/services/interaction/notification.service';

type FeedbackModule = typeof ActionModule &
  typeof StatusModule &
  typeof InteractionModule &
  typeof CommandsModule &
  typeof ProjectModule &
  typeof StoreModule &
  typeof HistoryModule &
  typeof BlockedModule;
const {
  ActionFeedbackService,
  NotificationService,
  InteractionStateService,
  WorkspaceActionsService,
  ProjectService,
  WorkspaceStore,
  ModelHistoryService,
  InteractionBlockedError,
}: FeedbackModule = await editorTestModule<FeedbackModule>([
  './editor/src/app/services/interaction/action-feedback.service',
  './editor/src/app/services/interaction/notification.service',
  './editor/src/app/services/interaction/interaction-state.service',
  './editor/src/app/services/workspace/model/workspace-actions.service',
  './editor/src/app/services/projects/project.service',
  './editor/src/app/states/workspace.store',
  './editor/src/app/services/workspace/model/model-history.service',
  './editor/src/app/models/InteractionBlockedError',
]);

const mockHistory: object = {
  capture: (): object => ({}),
  record: (): void => undefined,
  rollback: (): void => undefined,
  undo: (): void => undefined,
  redo: (): void => undefined,
};

function setup(overrides: { projects?: object; store?: object } = {}): {
  injector: EnvironmentInjector;
  actions: InstanceType<FeedbackModule['ActionFeedbackService']>;
  statuses: InstanceType<FeedbackModule['NotificationService']>;
  interactions: InstanceType<FeedbackModule['InteractionStateService']>;
  commands: InstanceType<FeedbackModule['WorkspaceActionsService']>;
} {
  const injector: EnvironmentInjector = createEnvironmentInjector(
    [
      ActionFeedbackService,
      NotificationService,
      InteractionStateService,
      WorkspaceActionsService,
      {
        provide: ProjectService,
        useValue: {
          loadedProjectId: (): string => 'project',
          records: (): readonly never[] => [],
          selectedProjectId: (): string => 'project',
          ...overrides.projects,
        },
      },
      { provide: WorkspaceStore, useValue: overrides.store ?? {} },
      { provide: ModelHistoryService, useValue: mockHistory },
      { provide: TranslocoService, useValue: { translate: (key: string): string => key } },
    ],
    Injector.NULL as EnvironmentInjector,
  );
  return {
    injector,
    actions: injector.get(ActionFeedbackService),
    statuses: injector.get(NotificationService),
    interactions: injector.get(InteractionStateService),
    commands: injector.get(WorkspaceActionsService),
  };
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

function modelCommands(commands: InstanceType<FeedbackModule['WorkspaceActionsService']>): (() => unknown)[] {
  return [
    (): unknown => commands.createNode({ name: 'New', baseNodeId: 'base' }),
    (): unknown => commands.updateNode('node', { name: 'Changed' }),
    (): unknown => commands.removeNode('node'),
    (): unknown => commands.duplicateNode('node'),
    (): unknown => commands.createAttribute('node', { name: 'p', typeId: 'String' }),
    (): unknown => commands.updateAttribute('node', 'p', { name: 'Changed' }),
    (): unknown => commands.duplicateAttribute('node', 'p'),
    (): unknown => commands.reorderAttributes('node', []),
    (): unknown => commands.removeAttribute('node', 'p'),
    (): unknown => commands.createAnnotationShape({ nodeId: 'node', type: 'p' }),
    (): unknown => commands.createAnnotationShapes([]),
    (): unknown => commands.updateAnnotationShape('shape', { type: 'p' }),
    (): unknown => commands.removeAnnotationShape('shape'),
    (): unknown => commands.saveShapeProperty('shape', { name: 'p', typeId: 'String' }),
    (): unknown => commands.removeShapeProperty('shape', 'p'),
    (): unknown => commands.createRelation({ from: { nodeId: 'a' }, to: { nodeId: 'b' } }),
    (): unknown => commands.updateRelation('relation', { name: 'Changed' }),
    (): unknown => commands.removeRelation('relation'),
    (): unknown => commands.undo(),
    (): unknown => commands.redo(),
    (): unknown => commands.createLevel({ name: 'New', uri: 'urn:new', version: '1.0.0' }),
    (): unknown => commands.updateLevel(1, { name: 'New', uri: 'urn:new', version: '1.0.0' }),
    (): unknown => commands.removeLevel(1),
    (): unknown => commands.removeVisibleNode('node'),
    (): unknown => commands.previewNodeRemoval('node'),
    (): unknown => commands.previewRelationRemoval('relation'),
    (): unknown => commands.previewLevelRemoval(1),
    (): unknown => commands.previewVisibleNodeRemoval('node'),
  ];
}

await test('decision blocks every model command before any store access, preserving the decision', async (): Promise<void> => {
  const { injector, interactions, commands }: ReturnType<typeof setup> = setup();
  const handle: ReturnType<typeof interactions.beginDecision> = interactions.beginDecision(
    'removal-review',
    'project',
    'revision',
  );
  const edits: (() => unknown)[] = modelCommands(commands);
  for (const edit of edits)
    await assert.rejects(async (): Promise<void> => {
      await edit();
    }, InteractionBlockedError);
  assert.equal(interactions.current().phase, 'decision');
  assert.equal(interactions.attention()?.interactionId, handle.id);
  assert.equal(interactions.attention()?.sequence, edits.length);
  interactions.end(handle);
  assert.equal(handle.signal.aborted, true);
  assert.equal(interactions.current().phase, 'ready');
  injector.destroy();
});

await test('execution blocks competing edits and double resume; failures restore the decision for retry', async (): Promise<void> => {
  const { injector, interactions }: ReturnType<typeof setup> = setup();
  const handle: ReturnType<typeof interactions.beginDecision> = interactions.beginDecision(
    'removal-review',
    'project',
    'revision',
  );
  let finish: (() => void) | undefined;
  const wait: Promise<void> = new Promise((resolve): void => {
    finish = resolve;
  });
  const execution: Promise<boolean> = interactions.executeDecision(handle, async (): Promise<void> => {
    await wait;
    throw new Error('Retry');
  });
  assert.equal(interactions.current().phase, 'executing');
  await assert.rejects(() => interactions.mutate('project', (): Promise<void> => Promise.resolve()), InteractionBlockedError);
  assert.equal(await interactions.executeDecision(handle, (): Promise<void> => Promise.resolve()), false);
  finish?.();
  await assert.rejects(execution, /Retry/);
  assert.equal(interactions.current().phase, 'decision');
  assert.equal(handle.signal.aborted, false);
  assert.equal(await interactions.executeDecision(handle, (): Promise<void> => Promise.resolve()), true);
  assert.equal(interactions.current().phase, 'ready');
  injector.destroy();
});

await test('context invalidation aborts pending work; stale completions cannot revive or clear another decision', async (): Promise<void> => {
  const { injector, interactions }: ReturnType<typeof setup> = setup();
  const old: ReturnType<typeof interactions.beginDecision> = interactions.beginDecision('removal-review', 'project', 'revision');
  let reject: ((error: Error) => void) | undefined;
  const wait: Promise<void> = new Promise((_resolve, rejectOperation): void => {
    reject = rejectOperation;
  });
  const execution: Promise<boolean> = interactions.executeDecision(old, (): Promise<void> => wait);
  interactions.end(old);
  const next: ReturnType<typeof interactions.beginDecision> = interactions.beginDecision(
    'removal-review',
    'another-project',
    'new-revision',
  );
  reject?.(new Error('Old operation'));
  await assert.rejects(execution, /Old operation/);
  interactions.end(old);
  const state: ReturnType<typeof interactions.current> = interactions.current();
  assert.ok(state.phase === 'decision');
  assert.equal(state.id, next.id);
  assert.equal(old.signal.aborted, true);
  interactions.end(next);
  injector.destroy();
});

await test('ordinary mutations hold the gate until persistence completes and release it after failure', async (): Promise<void> => {
  const { injector, interactions }: ReturnType<typeof setup> = setup();
  let finish: (() => void) | undefined;
  const wait: Promise<void> = new Promise((resolve): void => {
    finish = resolve;
  });
  const execution: Promise<void> = interactions.mutate('project', (): Promise<void> => wait);
  assert.equal(interactions.current().phase, 'executing');
  await assert.rejects(() => interactions.mutate('project', (): Promise<void> => Promise.resolve()), InteractionBlockedError);
  finish?.();
  await execution;
  assert.equal(interactions.current().phase, 'ready');
  await assert.rejects(
    () => interactions.mutate('project', (): Promise<void> => Promise.reject(new Error('Save failed'))),
    /Save failed/,
  );
  assert.equal(interactions.current().phase, 'ready');
  injector.destroy();
});

await test('validation remains non-blocking; a real create command holds execution until its save completes', async (): Promise<void> => {
  const draft: RamenModel = RamenModel.create('Command gate test');
  let finish: (() => void) | undefined;
  const wait: Promise<void> = new Promise((resolve): void => {
    finish = resolve;
  });
  const { injector, commands, interactions, actions }: ReturnType<typeof setup> = setup({
    projects: { selectedProjectId: (): string => 'project', saveModels: (): Promise<void> => wait },
    store: {
      getDraft: (): RamenModel => draft,
      getModels: (): ReturnType<RamenModel['getModels']> => draft.getModels(),
      currentModelRecord: (): null => null,
      notifyChange: (): void => undefined,
    },
  });
  actions.publish(review());
  const creating: ReturnType<typeof commands.createNode> = commands.createNode({
    name: 'Person',
    baseNodeId: RAMEN_ELEMENT.ENTITY,
  });
  assert.equal(interactions.current().phase, 'executing');
  assert.equal(draft.getModel().classifiers.filter((item): boolean => item.kind === 'Node').length, 1);
  await assert.rejects(() => commands.createNode({ name: 'Blocked', baseNodeId: RAMEN_ELEMENT.ENTITY }), InteractionBlockedError);
  assert.equal(draft.getModel().classifiers.filter((item): boolean => item.kind === 'Node').length, 1);
  finish?.();
  const created: Awaited<typeof creating> = await creating;
  assert.equal(created.name, 'Person');
  assert.equal(interactions.current().phase, 'ready');
  assert.equal(actions.current()?.owner, 'model-validation');
  injector.destroy();
});
