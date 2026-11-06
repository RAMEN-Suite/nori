import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { DataTypes, type Attribute } from '@ramen-suite/core/model';
import { beforeEach, expect, it, vi } from 'vitest';
import { TranslationLoader } from '../../../../../i18n/translation-loader';
import en from '../../../../../i18n/en.json';
import { ProjectService } from '../../../../../services/projects/project.service';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';
import { PropertyFormComponent } from './property-form.component';

beforeEach((): void => {
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' }, loader: TranslationLoader }),
      { provide: ProjectService, useValue: {} },
      {
        provide: WorkspaceService,
        useValue: {
          queries: {
            dataTypeSuggestions: (): readonly never[] => [],
            resolveTypeLabel: (): string => 'String',
            currentNode: (): null => null,
            inheritedAttributes: (): Map<string, never> => new Map<string, never>(),
          },
          store: { currentLevelIndex: (): number => 1 },
        },
      },
    ],
  });
  TestBed.inject(TranslocoService).setTranslation(en, 'en');
});

it('opens an existing property without submitting it and submits after a usage toggle', async (): Promise<void> => {
  const fixture: ComponentFixture<PropertyFormComponent> = TestBed.createComponent(PropertyFormComponent);
  const attribute: Attribute = {
    id: 'property',
    name: 'title',
    typeId: DataTypes.String,
    bounds: { lowerBound: 0, upperBound: 1 },
    isReadOnly: true,
  };
  const submit: ReturnType<typeof vi.fn<() => void>> = vi.fn<() => void>();
  fixture.componentRef.setInput('currentAttribute', attribute);
  fixture.componentRef.setInput('autoSave', true);
  fixture.componentRef.setInput('hideDefinition', true);
  fixture.componentInstance.submitRequested.subscribe(submit);
  await fixture.whenStable();

  const host: HTMLElement = fixture.nativeElement as HTMLElement;
  const toggle: HTMLInputElement | null = host.querySelector('#property-control-readonly');
  expect(toggle?.checked).toBe(true);
  expect(submit).not.toHaveBeenCalled();
  toggle?.click();
  await fixture.whenStable();
  expect(submit).toHaveBeenCalledTimes(1);
});
