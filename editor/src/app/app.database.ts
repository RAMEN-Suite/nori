import Dexie, { type Table, type Transaction } from 'dexie';
import { type Manifest } from './models/Manifest';
import { type ModelRecord } from './models/ModelRecord';

type LegacyModelRecord = Omit<ModelRecord, 'levelIndex'> & { slot?: number; levelIndex?: number };

export class AppDatabase extends Dexie {
  public readonly manifests!: Table<Manifest, string>;
  public readonly models!: Table<ModelRecord, string>;

  public constructor() {
    super('nori');
    this.version(1).stores({
      manifests: 'projectId, updatedAt, metamodelId',
      models: 'modelId, projectId, &[projectId+slot], updatedAt',
    });
    this.version(2)
      .stores({ models: 'modelId, projectId, &[projectId+levelIndex], updatedAt' })
      .upgrade(async (transaction: Transaction): Promise<void> => {
        await transaction
          .table<LegacyModelRecord, string>('models')
          .toCollection()
          .modify((record): void => {
            record.levelIndex = record.slot;
            delete record.slot;
          });
      });
  }
}

export const database: AppDatabase = new AppDatabase();
