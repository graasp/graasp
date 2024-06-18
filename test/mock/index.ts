import { BaseEntity, DataSource } from 'typeorm';

import { AppDataSource } from '../../src/plugins/datasource.js';
import defaultDatas from './sampledatas.js';

export type TableType<C extends BaseEntity, E> = {
  constructor: new () => C;
} & (
  | {
      factory: (e: Partial<E>) => E;
      entities: Partial<E>[];
    }
  | {
      factory?: never;
      entities: E[];
    }
);

/**
 * Push datas in Database with TypeOrm.
 * Use the constructors and the datas given in parameter to build BaseEntity object and save them on the Postgresql Database.
 * Integrity constraints are checked on the database, and will throw an exception if needed.
 * @param datas Datas to be pushed. Should contains constructor to build BaseEntity objects and sometimes Factory function to have default data.
 */
export default async function seed(
  datas: { [K in string]: TableType<BaseEntity, object> } = defaultDatas,
) {
  // Initialise Database
  const db: DataSource = AppDataSource;
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  console.log('Pushing mock data on database...');
  // Begin transation.
  await db.transaction(async (manager) => {
    for (const table of Object.values(datas)) {
      for (const mockEntity of table.entities) {
        const entity: BaseEntity = new table.constructor();
        Object.assign(entity, table.factory ? table.factory(mockEntity) : mockEntity);
        await manager.save(entity);
      }
    }
  });
  console.log('Database has been fed by mock data!');
}
