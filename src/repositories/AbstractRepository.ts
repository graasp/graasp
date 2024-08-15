import { BaseEntity, EntityManager, Repository } from 'typeorm';

import { AppDataSource } from '../plugins/datasource';

export type Entity<T extends BaseEntity> = { new (): T };

export abstract class AbstractRepository<T extends BaseEntity> {
  protected readonly repository: Repository<T>;

  constructor(entity: Entity<T>, manager?: EntityManager) {
    if (manager) {
      this.repository = manager.getRepository(entity);
    } else {
      this.repository = AppDataSource.getRepository(entity);
    }
  }
}
