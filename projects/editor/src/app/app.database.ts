import Dexie, { Table } from 'dexie';
import { Manifest } from './models/Manifest';
import { Model } from './models/Model';

export class AppDatabase extends Dexie {
  public readonly manifests!: Table<Manifest, string>;
  public readonly models!: Table<Model, string>;

  constructor() {
    super('nori');
    this.version(1).stores({
      manifests: 'projectId, updatedAt, metamodelId',
      models: 'modelId, projectId, [projectId+slot], updatedAt',
    });
  }
}

export const database = new AppDatabase();
