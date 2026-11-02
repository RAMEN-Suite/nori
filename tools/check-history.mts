import '@angular/compiler';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEnvironmentInjector, Injector, signal, type EnvironmentInjector, type WritableSignal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subject, type Observable } from 'rxjs';
import { RamenModel, RamenModelFormat, RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import { type Model, type Node, DataTypes } from '@ramen-suite/core/model';
import type { ModelRecord, ViewSettings } from '../editor/src/app/models/ModelRecord';
import type { WorkspaceLocation } from '../editor/src/app/models/WorkspaceLocation';
import { editorTestModule } from './testing/editor-test-module.mts';
import type * as HistoryModule from '../editor/src/app/services/workspace/model/model-history.service';
import type * as CommandsModule from '../editor/src/app/services/workspace/model/workspace-actions.service';
import type * as ProjectsModule from '../editor/src/app/services/projects/project.service';
import type * as StoreModule from '../editor/src/app/states/workspace.store';
import type * as NavigationModule from '../editor/src/app/services/interaction/navigation.service';
import type * as InteractionModule from '../editor/src/app/services/interaction/interaction-state.service';
import type * as OrderModule from '../editor/src/app/utils/model-order';
import type * as ErrorModule from '../editor/src/app/models/InteractionBlockedError';

type Runtime = typeof HistoryModule &
  typeof CommandsModule &
  typeof ProjectsModule &
  typeof StoreModule &
  typeof NavigationModule &
  typeof InteractionModule &
  typeof ErrorModule &
  typeof OrderModule;
const runtime: Runtime = await editorTestModule<Runtime>([
  './editor/src/app/services/workspace/model/model-history.service',
  './editor/src/app/services/workspace/model/workspace-actions.service',
  './editor/src/app/services/projects/project.service',
  './editor/src/app/states/workspace.store',
  './editor/src/app/services/interaction/navigation.service',
  './editor/src/app/services/interaction/interaction-state.service',
  './editor/src/app/models/InteractionBlockedError',
  './editor/src/app/utils/model-order',
]);

class ModelStore {
  private readonly version: WritableSignal<number> = signal(0);
  public readonly modelId: WritableSignal<string> = signal('');
  public readonly currentNodeId: WritableSignal<string | null> = signal(null);
  public readonly currentRelationId: WritableSignal<string | null> = signal(null);
  private references: readonly Model[] = [];
  private levels: Map<string, RamenModel> = new Map();
  public constructor(models: readonly Model[]) {
    this.restoreModels(models);
    this.modelId.set(models.at(-1)?.id ?? '');
  }
  public currentModel(): Model | null {
    this.version();
    return (
      this.levels.get(this.modelId())?.getModel() ?? this.references.find((model): boolean => model.id === this.modelId()) ?? null
    );
  }
  public getDraft(id: string = this.modelId()): RamenModel {
    const draft: RamenModel | undefined = this.levels.get(id);
    assert.ok(draft);
    return draft;
  }
  public getModels(): readonly Model[] {
    return [...this.references, ...[...this.levels.values()].map((draft): Model => draft.getModel())];
  }
  public restoreModels(models: readonly Model[]): void {
    this.references = structuredClone(models.filter((model): boolean => !RamenModelFormat.isDocument(model)));
    this.levels = new Map();
    const root: Model | undefined = [...models].reverse().find(RamenModelFormat.isDocument);
    if (root) {
      const workspace: RamenModel = RamenModel.load(
        root,
        models.filter((model): boolean => model.id !== root.id),
      );
      for (const model of models.filter(RamenModelFormat.isDocument)) this.levels.set(model.id, workspace.openLevel(model.id));
    }
    this.notifyChange();
  }
  public notifyChange(): void {
    this.version.update((version): number => version + 1);
  }
  public currentModelRecord(): null {
    return null;
  }
  public getCreationParent(): RamenModel {
    return this.getDraft();
  }
  public getWorkspace(): RamenModel {
    const draft: RamenModel | undefined = [...this.levels.values()].at(-1);
    assert.ok(draft);
    return draft;
  }
  public addLevel(draft: RamenModel): void {
    this.levels.set(draft.getModel().id, draft);
  }
  public getParentLevel(id: string): RamenModel {
    const parent: string | undefined = this.getDraft(id).getModel().imports[0]?.modelId;
    assert.ok(parent);
    return this.getDraft(parent);
  }
  public removeLevels(ids: readonly string[]): void {
    for (const id of ids) this.levels.delete(id);
    this.restoreModels(this.getModels());
  }
}

function recordsFor(
  models: readonly Model[],
  previous: readonly ModelRecord[] = [],
  recovered?: ReadonlyMap<string, ViewSettings>,
): ModelRecord[] {
  return runtime.orderModelsByImports(models).map(
    (model: Model, levelIndex: number): ModelRecord => ({
      projectId: 'project',
      modelId: model.id,
      gmodel: structuredClone(model),
      name: model.name,
      levelIndex,
      revision: (previous.find((record): boolean => record.gmodel.id === model.id)?.revision ?? 0) + 1,
      createdAt: '',
      updatedAt: '',
      view: previous.find((record): boolean => record.gmodel.id === model.id)?.view ?? recovered?.get(model.id),
    }),
  );
}

class HistoryProjects {
  public readonly project: WritableSignal<string | null> = signal('project');
  public readonly selectedProjectId: WritableSignal<string | null> = this.project;
  public readonly loadedProjectId: WritableSignal<string | null> = this.project;
  public readonly records: WritableSignal<ModelRecord[]>;
  private readonly selection: Subject<string | null> = new Subject();
  public readonly projectSelectionChanges$: Observable<string | null> = this.selection.asObservable();
  private failNext: boolean = false;
  private wait: Promise<void> = Promise.resolve();
  public constructor(models: readonly Model[]) {
    this.records = signal(recordsFor(models));
  }
  public recordsByModelId(): Map<string, ModelRecord> {
    return new Map(this.records().map((record): [string, ModelRecord] => [record.gmodel.id, record]));
  }
  public recordsByLevelIndex(): Map<number, ModelRecord> {
    return new Map(this.records().map((record): [number, ModelRecord] => [record.levelIndex, record]));
  }
  public async saveModels(id: string, models: readonly Model[], views?: ReadonlyMap<string, ViewSettings>): Promise<void> {
    await this.wait;
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Save failed');
    }
    if (id === this.project()) this.records.set(recordsFor(models, this.records(), views));
  }
  public reportError(error: unknown): never {
    throw error;
  }
  public fail(): void {
    this.failNext = true;
  }
  public select(id: string | null): void {
    this.project.set(id);
    this.selection.next(id);
  }
  public pause(): () => void {
    let finish: () => void = (): void => undefined;
    this.wait = new Promise((resolve): void => {
      finish = resolve;
    });
    return finish;
  }
}
interface HistoryHarness {
  injector: EnvironmentInjector;
  store: ModelStore;
  history: InstanceType<Runtime['ModelHistoryService']>;
  commands: InstanceType<Runtime['WorkspaceActionsService']>;
  interactions: InstanceType<Runtime['InteractionStateService']>;
  records: WritableSignal<ModelRecord[]>;
  selectProject: (id: string | null) => void;
  fail: () => void;
  pause: () => () => void;
}
function navigationFor(store: ModelStore, projects: HistoryProjects): object {
  return {
    navigateToLocation: (location: WorkspaceLocation): Promise<boolean> => {
      const record: ModelRecord | undefined = projects.recordsByLevelIndex().get(location.levelIndex);
      assert.ok(record);
      store.modelId.set(record.gmodel.id);
      store.currentNodeId.set(location.nodeId ?? null);
      store.currentRelationId.set(location.relationId ?? null);
      return Promise.resolve(true);
    },
  };
}
function harness(initial: RamenModel = RamenModel.create('History')): HistoryHarness {
  const store: ModelStore = new ModelStore(initial.getModels());
  const projects: HistoryProjects = new HistoryProjects(initial.getModels());
  const injector: EnvironmentInjector = createEnvironmentInjector(
    [
      runtime.ModelHistoryService,
      runtime.WorkspaceActionsService,
      runtime.InteractionStateService,
      { provide: runtime.WorkspaceStore, useValue: store },
      { provide: runtime.ProjectService, useValue: projects },
      { provide: TranslocoService, useValue: { translate: (key: string): string => key } },
      { provide: runtime.NavigationService, useValue: navigationFor(store, projects) },
    ],
    Injector.NULL as EnvironmentInjector,
  );
  return {
    injector,
    store,
    records: projects.records,
    history: injector.get(runtime.ModelHistoryService),
    commands: injector.get(runtime.WorkspaceActionsService),
    interactions: injector.get(runtime.InteractionStateService),
    selectProject: (id): void => projects.select(id),
    fail: (): void => projects.fail(),
    pause: (): (() => void) => projects.pause(),
  };
}

await test('every successful model command is undoable across node, property and annotation edits', async (): Promise<void> => {
  const h: ReturnType<typeof harness> = harness();
  const before: readonly Model[] = h.store.getModels();
  const node: Node = await h.commands.createNode({ name: 'Note', baseNodeId: RAMEN_ELEMENT.ANNOTATION });
  await h.commands.createAttribute(node.id, { name: 'source', typeId: DataTypes.String });
  await h.commands.createAnnotationShape({ node, type: 'p' });
  const after: readonly Model[] = h.store.getModels();
  assert.equal(h.history.canUndo(), true);
  for (let step: number = 0; step < 3; step++) await h.commands.undo();
  assert.deepEqual(h.store.getModels(), before);
  assert.equal(h.history.canUndo(), false);
  for (let step: number = 0; step < 3; step++) await h.commands.redo();
  assert.deepEqual(h.store.getModels(), after);
  h.injector.destroy();
});

await test('cascaded node deletion restores properties, shape rules and relationships as one step', async (): Promise<void> => {
  const initial: RamenModel = RamenModel.create('Deletion');
  const text: Node = initial.createNode({ name: 'Text', refines: RAMEN_ELEMENT.CONTENT }).element;
  const annotation: Node = initial.createNode({ name: 'Note', refines: RAMEN_ELEMENT.ANNOTATION }).element;
  initial.createAttribute(annotation, {
    name: 'source',
    typeId: DataTypes.String,
    constraints: [
      {
        id: 'source-rule-test-0001',
        name: 'Source format',
        language: 'regex',
        expression: '^https:',
        message: 'Use a source URL.',
      },
    ],
  });
  initial.hasAnnotation(text, annotation);
  initial.createAnnotationShape({ node: annotation, type: 'p' });
  const h: ReturnType<typeof harness> = harness(initial);
  h.store.currentNodeId.set(annotation.id);
  const before: readonly Model[] = h.store.getModels();
  await h.commands.removeNode(annotation.id, true);
  const after: readonly Model[] = h.store.getModels();
  await h.commands.undo();
  assert.deepEqual(h.store.getModels(), before);
  assert.equal(h.store.currentNodeId(), annotation.id);
  assert.equal(h.history.canUndo(), false);
  await h.commands.redo();
  assert.deepEqual(h.store.getModels(), after);
  assert.equal(h.store.currentNodeId(), null);
  h.injector.destroy();
});

await test('new changes clear redo, no-ops retain redo and failed saves create no history step', async (): Promise<void> => {
  const h: ReturnType<typeof harness> = harness();
  const node: Node = await h.commands.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY });
  await h.commands.updateNode(node.id, { name: 'Agent' });
  await h.commands.undo();
  await h.commands.updateNode(node.id, { name: 'Person' });
  assert.equal(h.history.canRedo(), true);
  h.fail();
  await assert.rejects(() => h.commands.removeNode(node.id, true), /Save failed/);
  assert.ok(h.store.getDraft().getNode(node.id));
  assert.equal(h.history.canRedo(), true);
  await h.commands.updateNode(node.id, { name: 'Author' });
  assert.equal(h.history.canRedo(), false);
  await h.commands.undo();
  assert.equal(h.store.getDraft().getNode(node.id)?.name, 'Person');
  h.injector.destroy();
});

await test('failed undo restores the live model and retains the same undo step for retry', async (): Promise<void> => {
  const h: ReturnType<typeof harness> = harness();
  await h.commands.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY });
  const before: readonly Model[] = h.store.getModels();
  h.fail();
  await assert.rejects(() => h.commands.undo(), /Save failed/);
  assert.deepEqual(h.store.getModels(), before);
  assert.equal(h.history.canUndo(), true);
  assert.equal(h.history.canRedo(), false);
  await h.commands.undo();
  assert.equal(h.history.canUndo(), false);
  assert.equal(h.history.canRedo(), true);
  h.injector.destroy();
});

await test('history follows the whole project across levels and recovers deleted level view settings', async (): Promise<void> => {
  const initial: RamenModel = RamenModel.create('Parent');
  const child: RamenModel = initial.createNextLevel('Child');
  const grandchild: RamenModel = child.createNextLevel('Grandchild');
  const h: ReturnType<typeof harness> = harness(grandchild);
  h.store.modelId.set(child.getModel().id);
  const view: ViewSettings = {
    nodeColors: { Content: '#123456' },
    graph: { positions: {}, viewport: { x: 5, y: 8, scale: 1.5 } },
  };
  h.records.update((records): ModelRecord[] =>
    records.map((record): ModelRecord => (record.gmodel.id === child.getModel().id ? { ...record, view } : record)),
  );
  const childIndex: number | undefined = h
    .records()
    .find((record): boolean => record.gmodel.id === child.getModel().id)?.levelIndex;
  assert.notEqual(childIndex, undefined);
  assert.ok(childIndex);
  const before: readonly Model[] = h.store.getModels();
  await h.commands.removeLevel(childIndex, true);
  h.store.modelId.set(initial.getModel().id);
  assert.equal(h.history.canUndo(), true);
  await h.commands.undo();
  assert.deepEqual(h.store.getModels(), before);
  assert.deepEqual(h.records().find((record): boolean => record.gmodel.id === child.getModel().id)?.view, view);
  assert.equal(h.store.modelId(), child.getModel().id);
  await h.commands.redo();
  assert.equal(
    h.store.getModels().some((model): boolean => model.id === child.getModel().id),
    false,
  );
  h.injector.destroy();
});

await test('pending decisions block undo/redo and project exit clears history including stale checkpoints', async (): Promise<void> => {
  const h: ReturnType<typeof harness> = harness();
  await h.commands.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY });
  const checkpoint: ReturnType<typeof h.history.capture> = h.history.capture();
  const handle: ReturnType<typeof h.interactions.beginDecision> = h.interactions.beginDecision(
    'removal-review',
    'project',
    'revision',
  );
  await assert.rejects(() => h.commands.undo(), runtime.InteractionBlockedError);
  assert.equal(h.history.canUndo(), true);
  h.interactions.end(handle);
  h.selectProject(null);
  h.selectProject('project');
  h.history.record(checkpoint);
  assert.equal(h.history.canUndo(), false);
  assert.equal(h.history.canRedo(), false);
  h.injector.destroy();
});

await test('stale undo completion after project switch never records or restores selection into the new session', async (): Promise<void> => {
  const h: HistoryHarness = harness();
  await h.commands.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY });
  const finish: () => void = h.pause();
  const undo: Promise<void> = h.commands.undo();
  const next: RamenModel = RamenModel.create('Another project');
  h.selectProject('another-project');
  h.store.restoreModels(next.getModels());
  h.store.modelId.set(next.getModel().id);
  finish();
  await undo;
  assert.deepEqual(h.store.getModels(), next.getModels());
  assert.equal(h.store.modelId(), next.getModel().id);
  assert.equal(h.history.canUndo(), false);
  h.injector.destroy();
});

await test('failed redo is retryable; edits outside history invalidate its stale chain', async (): Promise<void> => {
  const h: HistoryHarness = harness();
  const node: Node = await h.commands.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY });
  await h.commands.undo();
  h.fail();
  await assert.rejects(() => h.commands.redo(), /Save failed/);
  assert.equal(h.history.canRedo(), true);
  await h.commands.redo();
  h.store.getDraft().updateNode(node.id, { name: 'External' });
  h.store.notifyChange();
  assert.equal(h.history.canUndo(), false);
  await h.commands.updateNode(node.id, { name: 'New' });
  await h.commands.undo();
  assert.equal(h.store.getDraft().getNode(node.id)?.name, 'External');
  assert.equal(h.history.canUndo(), false);
  h.injector.destroy();
});

await test('history keeps the most recent fifty successful changes', async (): Promise<void> => {
  const h: HistoryHarness = harness();
  const node: Node = await h.commands.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY });
  for (let index: number = 0; index < 51; index++) await h.commands.updateNode(node.id, { name: `Name${index}` });
  for (let index: number = 0; index < 50; index++) await h.commands.undo();
  assert.equal(h.store.getDraft().getNode(node.id)?.name, 'Name0');
  assert.equal(h.history.canUndo(), false);
  h.injector.destroy();
});
