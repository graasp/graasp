import { BaseEntity, EntityManager, EntityTarget, Repository } from 'typeorm';

import { AppDataSource } from '../plugins/datasource';

export abstract class AbstractRepository<T extends BaseEntity> {
  protected repository: Repository<T>;
  protected entity: EntityTarget<T>;

  constructor(entity: EntityTarget<T>, manager?: EntityManager) {
    this.entity = entity;
    if (manager) {
      this.repository = manager.getRepository(entity);
    } else {
      this.repository = AppDataSource.getRepository(entity);
    }
  }
}
