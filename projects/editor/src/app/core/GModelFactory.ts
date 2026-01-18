import { GModel } from './models/GModel';
import { SchemaValidator } from './validation/SchemaValidator';

export interface CreateDerivedModelInput {
  readonly schemaId: string;
  readonly id: string;
  readonly name: string;
  readonly version: string;
}

export class GModelFactory {
  public static deriveModel(base: GModel, input: CreateDerivedModelInput): GModel {
    return {
      $schema: SchemaValidator.getSchemaNode().$id!,
      $id: input.schemaId,

      id: input.id,
      version: input.version,

      kind: 'GModel',
      name: input.name,

      imports: [
        {
          schemaId: base.$id,
          modelId: base.id,
        },
      ],

      classifiers: [],
      relations: [],
      ext: {},
    };
  }
}
