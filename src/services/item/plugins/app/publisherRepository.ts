import { AppDataSource } from '../../../../plugins/datasource';
import { App } from './entities/app';
import { Publisher } from './entities/publisher';

export const PublisherRepository = AppDataSource.getRepository(Publisher).extend({
  async getAllValidAppOrigins() {
    const publishers = await this.find();
    return publishers.map(({ origins }) => origins).flat();
  },
});
