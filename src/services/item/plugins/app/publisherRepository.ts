import { EntityManager } from 'typeorm';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { Publisher } from './entities/publisher';

export class PublisherRepository extends AbstractRepository<Publisher> {
  constructor(manager?: EntityManager) {
    super(Publisher, manager);
  }

  async getAllValidAppOrigins() {
    const publishers = await this.repository.find();
    return publishers.map(({ origins }) => origins).flat();
  }
}
