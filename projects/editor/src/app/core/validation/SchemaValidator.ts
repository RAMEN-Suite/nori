import { compileSchema, JsonError, SchemaNode } from 'json-schema-library';
import schema from '../../../data/schema/gcore.json';
import { GModel } from '../models/GModel';

export class SchemaValidator {
  private static schemaNode: SchemaNode = compileSchema(schema);

  public static getSchemaNode(): SchemaNode {
    return this.schemaNode;
  }

  public static isValid(input: unknown): input is GModel {
    return this.schemaNode.validate(input).valid;
  }

  public static assertValid(input: unknown): asserts input is GModel {
    const { valid, errors } = this.schemaNode.validate(input);
    if (!valid) {
      throw new Error(`Validation Error: ${SchemaValidator.formatErrors(errors)}`);
    }
  }

  private static formatErrors(errors: JsonError[]): string {
    return errors.map((error: JsonError): string => `[${error.code}] ${error.message}`).join('\n');
  }
}
