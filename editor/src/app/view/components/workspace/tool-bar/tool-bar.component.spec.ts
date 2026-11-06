import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { beforeEach, expect, it, vi } from 'vitest';
import { ActionFeedbackService } from '../../../../services/interaction/action-feedback.service';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { InteractionStateService } from '../../../../services/interaction/interaction-state.service';
import { NavigationService } from '../../../../services/interaction/navigation.service';
import { ShortcutService } from '../../../../services/interaction/shortcut.service';
import { ExportService } from '../../../../services/persistence/export.service';
import { ProjectService } from '../../../../services/projects/project.service';
import { GraphToolsService } from '../../../../services/workspace/editing/graph-tools.service';
import { PropertyEditingService } from '../../../../services/workspace/editing/property-editing.service';
import { ModelHistoryService } from '../../../../services/workspace/model/model-history.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { ToolBarComponent } from './tool-bar.component';

beforeEach((): void => {
  TestBed.configureTestingModule({
    providers: [
      { provide: TranslocoService, useValue: { translate: (key: string): string => key } },
      { provide: DialogService, useValue: { current: signal(null) } },
      { provide: PropertyEditingService, useValue: { current: signal(null) } },
      { provide: ModelHistoryService, useValue: { canUndo: signal(false), canRedo: signal(false) } },
      ...[NavigationService, ShortcutService, ExportService, ProjectService, GraphToolsService, WorkspaceService].map(
        (provide): { provide: typeof provide; useValue: object } => ({ provide, useValue: {} }),
      ),
    ],
  });
  TestBed.overrideComponent(ToolBarComponent, { set: { template: '' } });
});

it('cancels only the visible action when Escape is pressed', (): void => {
  const fixture: ComponentFixture<ToolBarComponent> = TestBed.createComponent(ToolBarComponent);
  fixture.detectChanges();

  const feedback: ActionFeedbackService = TestBed.inject(ActionFeedbackService);
  const interaction: InteractionStateService = TestBed.inject(InteractionStateService);
  const decision: ReturnType<InteractionStateService['beginDecision']> = interaction.beginDecision(
    'removal-review',
    'project',
    '1',
  );
  const cancelFindings: ReturnType<typeof vi.fn<() => void>> = vi.fn<() => void>();
  const findings: string = feedback.publish({
    owner: 'model-validation',
    severity: 'error',
    title: 'Findings',
    description: '',
    label: 'View',
    run: (): void => undefined,
    cancel: cancelFindings,
  });
  feedback.publish({
    owner: 'removal-review',
    severity: 'warning',
    title: 'Removal',
    description: '',
    label: 'Resume',
    run: (): void => undefined,
    cancel: (): void => interaction.end(decision),
  });

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(interaction.current().phase).toBe('ready');
  expect(cancelFindings).not.toHaveBeenCalled();
  expect(feedback.current()?.id).toBe(findings);
});
