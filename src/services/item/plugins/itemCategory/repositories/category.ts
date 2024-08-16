import { EntityManager } from 'typeorm';

import { AbstractRepository } from '../../../../../repositories/AbstractRepository';
import { GetAll } from '../../../../../repositories/interfaces';
import { Category } from '../entities/Category';

export class CategoryRepository extends AbstractRepository<Category> implements GetAll<Category> {
  constructor(manager?: EntityManager) {
    super(Category, manager);
  }

  async getAll(): Promise<Category[]> {
    return await this.repository.find();
  }
}
