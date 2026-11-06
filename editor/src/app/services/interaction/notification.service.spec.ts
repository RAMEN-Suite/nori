import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, expect, it, vi } from 'vitest';
import { ActionFeedbackService } from './action-feedback.service';
import { NotificationService } from './notification.service';

afterEach((): void => {
  vi.useRealTimers();
});

it('expires replacement statuses without dismissing the pending action', (): void => {
  vi.useFakeTimers();
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (key: string): string => key } }],
  });
  const statuses: NotificationService = TestBed.inject(NotificationService);
  const actions: ActionFeedbackService = TestBed.inject(ActionFeedbackService);
  const actionId: string = actions.publish({
    owner: 'model-validation',
    title: 'Review',
    description: 'Findings',
    severity: 'error',
    label: 'View',
    run: (): void => undefined,
    cancel: (): void => undefined,
  });
  const previous: string = statuses.show({ status: 'error', message: 'First' });
  const current: string = statuses.show({ status: 'success', message: 'Second' });
  statuses.dismiss(previous);
  expect(statuses.current()?.id).toBe(current);

  vi.advanceTimersByTime(60_000);
  expect(statuses.current()).toBeNull();
  expect(actions.current()?.id).toBe(actionId);
});

it('keeps failed removal actions retryable ahead of model findings', async (): Promise<void> => {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (key: string): string => key } }],
  });
  const actions: ActionFeedbackService = TestBed.inject(ActionFeedbackService);
  const statuses: NotificationService = TestBed.inject(NotificationService);
  const findingsId: string = actions.publish({
    owner: 'model-validation',
    title: 'Review',
    description: 'Findings',
    severity: 'error',
    label: 'View',
    run: (): void => undefined,
    cancel: (): void => undefined,
  });
  const removalId: string = actions.publish({
    owner: 'removal-review',
    title: 'Remove',
    description: 'Review the removal',
    severity: 'warning',
    label: 'Resume',
    run: (): Promise<void> => Promise.reject(new Error('Save failed')),
    cancel: (): void => undefined,
  });
  const removal: ReturnType<typeof actions.current> = actions.current();
  if (!removal) throw new Error('Expected a pending removal action.');

  await actions.run(removal);
  expect(statuses.current()?.message).toBe('Save failed');
  expect(actions.current()?.id).toBe(removalId);
  expect(actions.cancelCurrent()).toBe(true);
  expect(actions.current()?.id).toBe(findingsId);
});
