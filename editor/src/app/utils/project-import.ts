import { type Model, type ProjectMetadata } from '@ramen-suite/core/model';
import { RamenModelFormat, type RamenFile } from '@ramen-suite/core/ramen';
import fileSchema from '@ramen-suite/core/schemas/ramen-file.schema.json';
import { compileSchema, type SchemaNode } from 'json-schema-library';
import { orderModelsByImports } from './model-order';

export interface ImportedProject {
  readonly root: Model;
  readonly models: readonly Model[];
  readonly project: ProjectMetadata | undefined;
}

/** File errors prevent safe reconstruction; semantic findings belong to the editor's validation UI. */
export class ProjectImportError extends Error {}

const schema: SchemaNode = compileSchema(fileSchema);

function assertFile(input: unknown): asserts input is RamenFile {
  if (typeof input !== 'object' || input === null || !('$schema' in input) || input.$schema !== fileSchema.$id) {
    throw new ProjectImportError('Unsupported RAMEN file format.');
  }
  const result: ReturnType<SchemaNode['validate']> = schema.validate(input);
  if (!result.valid) {
    throw new ProjectImportError(result.errors.map((error): string => error.message).join('\n'));
  }
}

function restoreModels(file: RamenFile): Map<string, Model> {
  const models: Map<string, Model> = new Map();
  for (const header of file.models) {
    if (models.has(header.id)) throw new ProjectImportError(`Duplicate model identity: '${header.id}'.`);
    const model: Model = { ...header, classifiers: [], relations: [] };
    if (RamenModelFormat.isDocument(model)) model.annotations = [];
    models.set(model.id, model);
  }
  for (const entry of file.classifiers) {
    const { modelId, ...classifier } = entry;
    requireOwner(models, modelId).classifiers.push(classifier);
  }
  for (const entry of file.relations) {
    const { modelId, ...relation } = entry;
    requireOwner(models, modelId).relations.push(relation);
  }
  for (const entry of file.annotations) {
    const { modelId, ...annotation } = entry;
    const owner: Model = requireOwner(models, modelId);
    if (!RamenModelFormat.isDocument(owner)) throw new ProjectImportError(`Invalid annotation owner: '${modelId}'.`);
    owner.annotations = [...owner.annotations, annotation];
  }
  return models;
}

function requireOwner(models: ReadonlyMap<string, Model>, id: string): Model {
  const owner: Model | undefined = models.get(id);
  if (!owner) throw new ProjectImportError(`Unknown declaration owner: '${id}'.`);
  return owner;
}

/** Uses Core's published transport schema without requiring semantic validity or fabricating missing dependencies. */
export function readProjectForEditing(input: unknown): ImportedProject {
  assertFile(input);
  const file: RamenFile = structuredClone(input);
  const models: Map<string, Model> = restoreModels(file);
  const root: Model = requireOwner(models, file.id);
  if (!RamenModelFormat.isDocument(root)) throw new ProjectImportError('Expected a RAMEN project model.');
  let ordered: Model[];
  try {
    ordered = orderModelsByImports([...models.values()]);
  } catch {
    throw new ProjectImportError('Model imports contain a cycle and cannot be opened as editor levels.');
  }
  return { root, models: ordered, project: file.project };
}
