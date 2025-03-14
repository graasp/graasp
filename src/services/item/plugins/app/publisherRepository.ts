import { DBConnection } from '../../../../drizzle/db.js';

export class PublisherRepository {
  async getAllValidAppOrigins(db: DBConnection) {
    const publishers = await db.query.publishers.findMany({ columns: { origins: true } });
    return publishers.map(({ origins }) => origins).flat();
  }
}
