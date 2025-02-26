import { and, eq } from 'drizzle-orm';

import { UUID } from '@graasp/sdk';

import { DBConnection } from '../../../drizzle/db';
import { isAncestorOrSelf } from '../../../drizzle/operations';
import { accounts, guestsView, itemLoginSchemas } from '../../../drizzle/schema';
import { Item } from '../../item/entities/Item';
import { Guest } from '../entities/guest';

export class GuestRepository {
  async getForItemAndUsername(
    db: DBConnection,
    item: Item,
    username: string,
  ): Promise<Guest | null> {
    return db
      .select()
      .from(guestsView)
      .where(eq(guestsView.name, username))
      .leftJoin(
        itemLoginSchemas,
        and(
          eq(itemLoginSchemas.id, guestsView.itemLoginSchemaId),
          isAncestorOrSelf(itemLoginSchemas.itemPath, item.path),
        ),
      );
  }

  async addOne(db: DBConnection, guestData: Partial<Omit<Guest, 'id'>>): Promise<Guest> {
    return await db.insert(accounts).values(guestData);
  }

  async refreshLastAuthenticatedAt(db: DBConnection, id: UUID) {
    return await db
      .update(accounts)
      .set({ lastAuthenticatedAt: new Date().toISOString() })
      .where(eq(accounts.id, id))
      .returning();
  }
}
