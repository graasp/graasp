import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { pageTable } from '../../../../drizzle/schema';

@singleton()
export class PageRepository {
  async createContent(dbConnection: DBConnection, itemId: string): Promise<void> {
    await dbConnection.insert(pageTable).values({ itemId });
  }

  async updateContent(dbConnection: DBConnection, content: string): Promise<void> {
    await dbConnection.update(pageTable).set({ content });
  }
}
