import ramen from '../data/schema/metamodels/ramen.gcore.json';
import { SchemaValidator } from '../utils/SchemaValidator';
import { GModel } from '../models/GModel';

SchemaValidator.assertValid(ramen);

export const CATALOG: GModel[] = [ramen];
