import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSync, type BuildResult } from 'esbuild';
import { RAMEN_ELEMENT, RamenModel, RamenModelFormat, type RamenFile } from '@ramen-suite/core/ramen';
import { DataTypes, type Model } from '@ramen-suite/core/model';
import type { ImportedProject } from '../editor/src/app/utils/project-import';

type Reader = (input: unknown) => ImportedProject;
const bundle: BuildResult = buildSync({
  entryPoints: ['editor/src/app/utils/project-import.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const source: string | undefined = bundle.outputFiles?.[0]?.text;
assert.ok(source);
const { readProjectForEditing }: { readProjectForEditing: Reader } = (await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
)) as { readProjectForEditing: Reader };

function fixture(name: string): RamenFile {
  return JSON.parse(readFileSync(`examples/import-models/${name}.json`, 'utf8')) as RamenFile;
}

function load(project: ImportedProject): RamenModel {
  return RamenModel.load(
    project.root,
    project.models.filter((model: Model): boolean => model.id !== project.root.id),
  );
}

const valid: RamenFile = fixture('01-valid');
assert.deepEqual(load(readProjectForEditing(valid)).export(valid.project), RamenModel.import(valid).export(valid.project));
const annotated: RamenModel = RamenModel.import(valid);
annotated.createAnnotationShape({
  nodeId: RAMEN_ELEMENT.ANNOTATION,
  type: 'p',
  description: 'Paragraph',
  properties: [{ name: 'language', typeId: DataTypes.String }],
});
const annotatedFile: RamenFile = annotated.export(valid.project);
assert.deepEqual(load(readProjectForEditing(annotatedFile)).export(valid.project), annotatedFile);

for (const name of ['02-duplicate-property', '03-unknown-datatype', '04-invalid-refinement', '05-missing-dependency']) {
  const input: RamenFile = fixture(name);
  const before: RamenFile = structuredClone(input);
  const restored: ImportedProject = readProjectForEditing(input);
  const draft: RamenModel = load(restored);
  assert.equal(draft.validate().valid, false, `${name}: diagnostics must remain available`);
  assert.equal(restored.models.length, input.models.length, `${name}: no dependency may be injected`);
  assert.equal(
    restored.models.flatMap((model: Model): Model['classifiers'] => model.classifiers).length,
    input.classifiers.length,
  );
  assert.equal(restored.models.flatMap((model: Model): Model['relations'] => model.relations).length, input.relations.length);
  for (const model of restored.models.filter(RamenModelFormat.isDocument)) draft.openLevel(model.id);
  assert.deepEqual(input, before, `${name}: importing must not mutate the file`);
}

const duplicate: RamenModel = load(readProjectForEditing(fixture('02-duplicate-property')));
const text: Model['classifiers'][number] | undefined = duplicate
  .getModel()
  .classifiers.find((item): boolean => item.name === 'Text');
assert.ok(text?.kind === 'Node');
assert.ok(text.attributes[1]);
duplicate.updateAttribute(text.id, text.attributes[1].id, { name: 'sourceUrl' });
assert.equal(duplicate.validate().valid, true, 'an imported invalid model can be repaired');
assert.doesNotThrow((): void => {
  duplicate.export();
});

assert.throws((): ImportedProject => readProjectForEditing(fixture('06-malformed-document')), /type `array`/);
assert.throws((): ImportedProject => readProjectForEditing({ ...valid, $schema: 'unknown' }), /Unsupported/);
assert.throws(
  (): ImportedProject => readProjectForEditing({ ...valid, models: [...valid.models, valid.models[0]] }),
  /Duplicate model/,
);
assert.throws(
  (): ImportedProject => readProjectForEditing({ ...valid, id: 'missing-root-model-0001' }),
  /Unknown declaration owner/,
);
const orphan: RamenFile = structuredClone(valid);
const first: RamenFile['classifiers'][number] | undefined = orphan.classifiers[0];
assert.ok(first);
assert.throws(
  (): ImportedProject =>
    readProjectForEditing({
      ...orphan,
      classifiers: [{ ...first, modelId: 'missing-owner-model-0001' }, ...orphan.classifiers.slice(1)],
    }),
  /Unknown declaration owner/,
);
const cyclic: RamenFile = structuredClone(valid);
const header: RamenFile['models'][number] | undefined = cyclic.models.find((model): boolean => model.id === cyclic.id);
assert.ok(header);
header.imports.push({ modelId: header.id, modelUri: header.$id, version: header.version });
assert.throws((): ImportedProject => readProjectForEditing(cyclic), /cycle/);
console.log(
  'Import checks passed: valid round trip, four invalid models, repair, malformed files, identities, ownership and cycles.',
);
