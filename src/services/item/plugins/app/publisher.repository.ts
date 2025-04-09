import { DBConnection } from '../../../../drizzle/db';

export class PublisherRepository {
  async getAllValidAppOrigins(db: DBConnection) {
    const publishers = await db.query.publishersTable.findMany({ columns: { origins: true } });
    return publishers.map(({ origins }) => origins).flat();
  }
}
