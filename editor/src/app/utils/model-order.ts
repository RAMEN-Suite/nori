import { type Model } from '@ramen-suite/core/model';

export function orderModelsByImports(models: readonly Model[]): Model[] {
  const byId: ReadonlyMap<string, Model> = new Map(models.map((model: Model): [string, Model] => [model.id, model]));
  const ordered: Model[] = [];
  const visited: Set<string> = new Set();
  const visiting: Set<string> = new Set();

  function visit(model: Model): void {
    if (visited.has(model.id)) return;
    if (visiting.has(model.id)) throw new Error('Model levels cannot be ordered because their imports contain a cycle.');

    visiting.add(model.id);
    for (const reference of model.imports) {
      const base: Model | undefined = byId.get(reference.modelId);
      if (base) visit(base);
    }
    visiting.delete(model.id);
    visited.add(model.id);
    ordered.push(model);
  }

  for (const model of models) visit(model);
  return ordered;
}
