import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { DataTypes, type Model, type Node } from '@ramen-suite/core/model';
import { RAMEN_ELEMENT, RamenModel } from '@ramen-suite/core/ramen';
import { firstValueFrom, ReplaySubject, Subject } from 'rxjs';
import { beforeEach, expect, it, vi } from 'vitest';
import { type ModelRecord } from '../../../models/ModelRecord';
import { WorkspaceStore } from '../../../states/workspace.store';
import { InteractionStateService } from '../../interaction/interaction-state.service';
import { NavigationService } from '../../interaction/navigation.service';
import { ProjectService } from '../../projects/project.service';
import { ModelHistoryService } from './model-history.service';
import { WorkspaceActionsService } from './workspace-actions.service';

const projectId: WritableSignal<string | null> = signal('project');
const projectSelectionChanges: Subject<string> = new Subject();
const navigate: ReturnType<typeof vi.fn<() => Promise<boolean>>> = vi.fn<() => Promise<boolean>>();
const saveModels: ReturnType<typeof vi.fn<() => Promise<void>>> = vi.fn<() => Promise<void>>();

beforeEach((): void => {
  const models: readonly Model[] = RamenModel.create('Test workspace').getModels();
  const records: WritableSignal<ModelRecord[]> = signal(
    models.map((model, levelIndex): ModelRecord => ({
      projectId: 'project',
      modelId: model.id,
      gmodel: model,
      name: model.name,
      levelIndex,
      revision: 1,
      createdAt: '',
      updatedAt: '',
    })),
  );
  projectId.set('project');
  navigate.mockReset().mockResolvedValue(true);
  saveModels.mockReset().mockResolvedValue(undefined);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ProjectService,
        useValue: {
          loadedProjectId: projectId,
          selectedProjectId: projectId,
          projectSelectionChanges$: projectSelectionChanges,
          records,
          saveModels,
          recordsByLevelIndex: (): Map<number, ModelRecord> => new Map(records().map((record) => [record.levelIndex, record])),
          recordsByModelId: (): Map<string, ModelRecord> => new Map(records().map((record) => [record.gmodel.id, record])),
        },
      },
      { provide: NavigationService, useValue: { navigateToLocation: navigate } },
      { provide: TranslocoService, useValue: { translate: (key: string): string => key } },
    ],
  });
  TestBed.inject(WorkspaceStore);
  TestBed.tick();
});

it('undoes and redoes a cascaded deletion as one command', async (): Promise<void> => {
  const actions: WorkspaceActionsService = TestBed.inject(WorkspaceActionsService);
  const store: WorkspaceStore = TestBed.inject(WorkspaceStore);
  const draft: RamenModel = store.getDraft();
  const text: Node = draft.createNode({ name: 'Text', refines: RAMEN_ELEMENT.CONTENT }).element;
  const note: Node = draft.createNode({ name: 'Note', refines: RAMEN_ELEMENT.ANNOTATION }).element;
  draft.createAttribute(note, { name: 'source', typeId: DataTypes.String });
  draft.hasAnnotation(text, note);
  draft.createAnnotationShape({ node: note, type: 'p' });
  store.notifyChange();
  const before: readonly Model[] = store.getModels();

  await actions.removeNode(note.id, true);
  const after: readonly Model[] = store.getModels();
  expect(store.getDraft().getNode(note.id)).toBeUndefined();

  await actions.undo();
  expect(store.getModels()).toEqual(before);
  expect(TestBed.inject(ModelHistoryService).canUndo()).toBe(false);
  await actions.redo();
  expect(store.getModels()).toEqual(after);
});

it('restores the model after a failed save and leaves the command out of history', async (): Promise<void> => {
  const actions: WorkspaceActionsService = TestBed.inject(WorkspaceActionsService);
  const store: WorkspaceStore = TestBed.inject(WorkspaceStore);
  const before: readonly Model[] = store.getModels();
  saveModels.mockRejectedValueOnce(new Error('Save failed'));

  await expect(actions.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY })).rejects.toThrow('Save failed');
  expect(store.getModels()).toEqual(before);
  expect(TestBed.inject(ModelHistoryService).canUndo()).toBe(false);
});

it('blocks model writes during a pending decision', async (): Promise<void> => {
  const actions: WorkspaceActionsService = TestBed.inject(WorkspaceActionsService);
  const gate: InteractionStateService = TestBed.inject(InteractionStateService);
  gate.beginDecision('removal-review', 'project', '1');

  await expect(actions.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY })).rejects.toThrow();
  expect(saveModels).not.toHaveBeenCalled();
  expect(gate.current().phase).toBe('decision');
});

it('keeps a failed undo retryable and restores the live model until retry succeeds', async (): Promise<void> => {
  const actions: WorkspaceActionsService = TestBed.inject(WorkspaceActionsService);
  const store: WorkspaceStore = TestBed.inject(WorkspaceStore);
  const history: ModelHistoryService = TestBed.inject(ModelHistoryService);
  const node: Node = await actions.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY });
  saveModels.mockRejectedValueOnce(new Error('Save failed'));

  await expect(actions.undo()).rejects.toThrow('Save failed');
  expect(store.getDraft().getNode(node.id)).toBeDefined();
  expect(history.canUndo()).toBe(true);
  expect(history.canRedo()).toBe(false);

  await actions.undo();
  expect(store.getDraft().getNode(node.id)).toBeUndefined();
  expect(history.canRedo()).toBe(true);
});

it('keeps only the fifty most recent changes', async (): Promise<void> => {
  const actions: WorkspaceActionsService = TestBed.inject(WorkspaceActionsService);
  const store: WorkspaceStore = TestBed.inject(WorkspaceStore);
  const node: Node = await actions.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY });

  for (let index: number = 0; index < 51; index++) await actions.updateNode(node.id, { name: `Name${index}` });
  for (let index: number = 0; index < 50; index++) await actions.undo();

  expect(store.getDraft().getNode(node.id)?.name).toBe('Name0');
  expect(TestBed.inject(ModelHistoryService).canUndo()).toBe(false);
});

it('does not carry undo history or selection across a project switch during a save', async (): Promise<void> => {
  const actions: WorkspaceActionsService = TestBed.inject(WorkspaceActionsService);
  const store: WorkspaceStore = TestBed.inject(WorkspaceStore);
  const history: ModelHistoryService = TestBed.inject(ModelHistoryService);
  await actions.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY });
  const save: Subject<void> = new Subject();
  const saving: ReplaySubject<void> = new ReplaySubject(1);
  saveModels.mockImplementationOnce((): Promise<void> => {
    saving.next();
    return firstValueFrom(save);
  });
  const undo: Promise<void> = actions.undo();
  await firstValueFrom(saving);

  const nextModels: readonly Model[] = RamenModel.create('Another workspace').getModels();
  projectId.set('another-project');
  projectSelectionChanges.next('another-project');
  TestBed.tick();
  store.restoreModels(nextModels);
  navigate.mockClear();
  save.next();
  await undo;

  expect(store.getModels()).toEqual(nextModels);
  expect(history.canUndo()).toBe(false);
  expect(history.canRedo()).toBe(false);
  expect(navigate).not.toHaveBeenCalled();
});

it('does not replay redo after the model changes outside history', async (): Promise<void> => {
  const actions: WorkspaceActionsService = TestBed.inject(WorkspaceActionsService);
  const store: WorkspaceStore = TestBed.inject(WorkspaceStore);
  const history: ModelHistoryService = TestBed.inject(ModelHistoryService);

  const node: Node = await actions.createNode({ name: 'Person', baseNodeId: RAMEN_ELEMENT.ENTITY });
  await actions.undo();
  expect(history.canRedo()).toBe(true);

  const external: Node = store.getDraft().createNode({ name: 'Place', refines: RAMEN_ELEMENT.ENTITY }).element;
  store.notifyChange();
  expect(history.canRedo()).toBe(false);

  await actions.redo();
  expect(store.getDraft().getNode(node.id)).toBeUndefined();
  expect(store.getDraft().getNode(external.id)?.name).toBe('Place');
});
