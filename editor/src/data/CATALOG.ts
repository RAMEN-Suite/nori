import { RAMEN_MODEL } from '@ramen-suite/core/ramen';
import example from './schema/examples/example.gcore.json';
import { GModel, SchemaValidator } from '@ramen-suite/core/gcore';

const ramen: unknown = RAMEN_MODEL;
SchemaValidator.assertValid(ramen);
SchemaValidator.assertValid(example);

export const CATALOG: [GModel] = [ramen];
export const EXAMPLES: [GModel] = [example];
