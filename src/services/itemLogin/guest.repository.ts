import { and, eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { UUID } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { isAncestorOrSelf } from '../../drizzle/operations';
import { accountsTable, guestsView, itemLoginSchemas } from '../../drizzle/schema';
import { GuestRaw, GuestWithItemLoginSchema, Item } from '../../drizzle/types';
import { AccountType } from '../../types';

@singleton()
export class GuestRepository {
  async getForItemAndUsername(
    db: DBConnection,
    item: Item,
    username: string,
  ): Promise<GuestWithItemLoginSchema | undefined> {
    // TODO: use guestsView
    const res = await db
      .select()
      .from(guestsView)
      .innerJoin(
        itemLoginSchemas,
        and(
          eq(itemLoginSchemas.id, guestsView.itemLoginSchemaId),
          isAncestorOrSelf(itemLoginSchemas.itemPath, item.path),
        ),
      )
      .where(eq(guestsView.name, username));
    const guest = res.at(0);
    if (!guest) {
      return undefined;
    }
    return {
      ...guest.guests_view,
      type: AccountType.Guest,
      itemLoginSchema: guest.item_login_schema,
    };
  }

  async addOne(
    db: DBConnection,
    guestData: { name: string; itemLoginSchemaId: string },
  ): Promise<GuestRaw> {
    const res = await db
      .insert(accountsTable)
      .values({ ...guestData, type: AccountType.Guest })
      .returning();
    const guest = res.at(0);
    if (!res) {
      throw new Error('Could not find created entitiy');
    }
    // FIXME: casting is ugly because db table schema allows nullables...
    return { ...guest, type: AccountType.Guest } as GuestRaw;
  }

  async refreshLastAuthenticatedAt(db: DBConnection, id: UUID) {
    const res = await db
      .update(accountsTable)
      .set({ lastAuthenticatedAt: new Date().toISOString() })
      .where(eq(accountsTable.id, id))
      .returning();
    return res[0];
  }
}
