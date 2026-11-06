import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, Subject } from 'rxjs';
import { beforeEach, expect, it, vi } from 'vitest';
import { InteractionBlockedError } from '../../models/InteractionBlockedError';
import { InteractionStateService, type InteractionHandle } from './interaction-state.service';

beforeEach((): void => {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (key: string): string => key } }],
  });
});

it('keeps a failed decision open for retry and blocks unrelated edits', async (): Promise<void> => {
  const gate: InteractionStateService = TestBed.inject(InteractionStateService);
  const decision: InteractionHandle = gate.beginDecision('removal-review', 'project', '1');
  const edit: ReturnType<typeof vi.fn<() => Promise<void>>> = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  await expect(gate.mutate('project', edit)).rejects.toBeInstanceOf(InteractionBlockedError);
  expect(edit).not.toHaveBeenCalled();
  expect(gate.attention()?.interactionId).toBe(decision.id);
  await expect(gate.executeDecision(decision, (): Promise<void> => Promise.reject(new Error('Save failed')))).rejects.toThrow(
    'Save failed',
  );
  expect(gate.current().phase).toBe('decision');
  await expect(gate.executeDecision(decision, edit)).resolves.toBe(true);
  expect(gate.current().phase).toBe('ready');
});

it('ignores completion from a cancelled decision after a new decision starts', async (): Promise<void> => {
  const gate: InteractionStateService = TestBed.inject(InteractionStateService);
  const first: InteractionHandle = gate.beginDecision('removal-review', 'first', '1');
  const operation: Subject<void> = new Subject();
  const completion: Promise<boolean> = gate.executeDecision(first, (): Promise<void> => firstValueFrom(operation));
  gate.end(first);
  const second: InteractionHandle = gate.beginDecision('removal-review', 'second', '1');
  operation.next();

  await expect(completion).resolves.toBe(false);
  expect(first.signal.aborted).toBe(true);
  expect(gate.current()).toMatchObject({ phase: 'decision', id: second.id });
});
