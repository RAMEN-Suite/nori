import ramen from './schema/metamodels/ramen.gcore.json';
import example from './schema/examples/socinian.gcore.json';
import { SchemaValidator } from '../app/core/validation/SchemaValidator';
import { GModel } from '../app/models/GModel';

SchemaValidator.assertValid(ramen);
SchemaValidator.assertValid(example);

export const CATALOG: GModel[] = [ramen];
export const EXAMPLES: GModel[] = [example];
