import ramen from './schema/metamodels/ramen.gcore.json';
import { SchemaValidator } from '../app/core/SchemaValidator';
import { GModel } from '../app/models/GModel';

SchemaValidator.assertValid(ramen);

export const CATALOG: GModel[] = [ramen];
