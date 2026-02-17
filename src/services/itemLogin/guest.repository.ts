import { and, eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import type { UUID } from '@graasp/sdk';

import type { DBConnection } from '../../drizzle/db';
import { isAncestorOrSelf } from '../../drizzle/operations';
import { accountsTable, guestsView, itemLoginSchemasTable } from '../../drizzle/schema';
import { type GuestRaw, type GuestWithItemLoginSchema } from '../../drizzle/types';
import { AccountType } from '../../types';
import type { ItemRaw } from '../item/item';

@singleton()
export class GuestRepository {
  async getForItemAndUsername(
    dbConnection: DBConnection,
    item: ItemRaw,
    username: string,
  ): Promise<GuestWithItemLoginSchema | undefined> {
    const res = await dbConnection
      .select()
      .from(guestsView)
      .innerJoin(
        itemLoginSchemasTable,
        and(
          eq(itemLoginSchemasTable.id, guestsView.itemLoginSchemaId),
          isAncestorOrSelf(itemLoginSchemasTable.itemPath, item.path),
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
    dbConnection: DBConnection,
    guestData: { name: string; itemLoginSchemaId: string },
  ): Promise<GuestRaw> {
    const res = await dbConnection
      .insert(accountsTable)
      .values({ ...guestData, type: AccountType.Guest })
      .returning();
    const guest = res.at(0);
    if (!guest) {
      throw new Error('Could not find created entitiy');
    }
    return guest as GuestRaw;
  }

  async refreshLastAuthenticatedAt(dbConnection: DBConnection, id: UUID) {
    const res = await dbConnection
      .update(accountsTable)
      .set({ lastAuthenticatedAt: new Date().toISOString() })
      .where(eq(accountsTable.id, id))
      .returning();
    return res[0];
  }
}
