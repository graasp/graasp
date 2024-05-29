import { BaseEntity, EntityManager, EntityTarget, Repository } from 'typeorm';

import { AppDataSource } from './plugins/datasource';

export abstract class AbstractRepository<T extends BaseEntity> {
  protected repository: Repository<T>;

  constructor(entity: EntityTarget<T>, manager?: EntityManager) {
    if (manager) {
      this.repository = manager.getRepository(entity);
    } else {
      this.repository = AppDataSource.getRepository(entity);
    }
  }
}
