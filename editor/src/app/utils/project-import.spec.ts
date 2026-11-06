import { type Node } from '@ramen-suite/core/model';
import { RamenModel } from '@ramen-suite/core/ramen';
import { describe, expect, it } from 'vitest';
import validFile from '../../../../examples/import-models/01-valid.json';
import duplicateProperty from '../../../../examples/import-models/02-duplicate-property.json';
import malformedFile from '../../../../examples/import-models/06-malformed-document.json';
import { readProjectForEditing, type ImportedProject } from './project-import';

describe('Project import', (): void => {
  it('preserves the model and project metadata on a valid round trip', (): void => {
    const project: ImportedProject = readProjectForEditing(validFile);
    const model: RamenModel = RamenModel.load(
      project.root,
      project.models.filter((entry): boolean => entry.id !== project.root.id),
    );
    expect(model.export(project.project)).toEqual(RamenModel.import(validFile).export(project.project));
  });

  it('opens semantic errors for repair without changing the source file', (): void => {
    const before: unknown = structuredClone(duplicateProperty);
    const project: ImportedProject = readProjectForEditing(duplicateProperty);
    const model: RamenModel = RamenModel.load(
      project.root,
      project.models.filter((entry): boolean => entry.id !== project.root.id),
    );
    expect(model.validate().valid).toBe(false);
    const text: Node | undefined = model
      .getModel()
      .classifiers.find((node): node is Node => node.kind === 'Node' && node.name === 'Text');
    const duplicate: string | undefined = text?.attributes[1]?.id;
    if (!text || !duplicate) throw new Error('Expected the duplicate property in the fixture.');
    model.updateAttribute(text.id, duplicate, { name: 'sourceUrl' });
    expect(model.validate().valid).toBe(true);
    expect(duplicateProperty).toEqual(before);
  });

  it('rejects a structurally invalid file', (): void => {
    expect((): ImportedProject => readProjectForEditing(malformedFile)).toThrow(/array/);
  });
});
