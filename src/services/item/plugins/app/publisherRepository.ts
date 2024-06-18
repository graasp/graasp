import { AppDataSource } from '../../../../plugins/datasource.js';
import { Publisher } from './entities/publisher.js';

export const PublisherRepository = AppDataSource.getRepository(Publisher).extend({
  async getAllValidAppOrigins() {
    const publishers = await this.find();
    return publishers.map(({ origins }) => origins).flat();
  },
});
