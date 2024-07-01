import { BaseEntity, DataSource } from 'typeorm';

import { AppDataSource } from '../../src/plugins/datasource';
import defaultDatas from './sampledatas';

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
  const result: { [K in keyof typeof datas]: BaseEntity[] } = {};
  // Begin transation.
  await db.transaction(async (manager) => {
    for (const key in datas) {
      const table = datas[key];
      const entities: BaseEntity[] = [];
      for (const mockEntity of table.entities) {
        const entity: BaseEntity = new table.constructor();
        Object.assign(entity, table.factory ? table.factory(mockEntity) : mockEntity);
        const e = await manager.save(entity);
        entities.push(e);
      }
      result[key] = entities;
    }
  });
  return result;
}
