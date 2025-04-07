import { count, sql } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { actionsTable } from '../../../../drizzle/schema';
import { Item } from '../../../../drizzle/types';
import { MaybeUser } from '../../../../types';

@singleton()
export class ItemActionRepository {
  private sanitizeName(name: string) {
    // remove useless spacing
    return name.trim().replace(/ +(?= )/g, '');
  }

  async getActionsByDay(db: DBConnection, itemId: Item['id'], actor: MaybeUser): Promise<void> {
    const actions = await db
      .select({
        day: sql<string>`date_trunc('day', ${actionsTable.createdAt})`,
        accountId: actionsTable.accountId,
        type: actionsTable.type,
        views: count(),
      })
      .from(actionsTable)
      .where(eq(actionsTable.itemId, itemId))
      .groupBy(() => [
        sql`date_trunc('day', ${actionsTable.createdAt})`,
        actionsTable.accountId,
        actionsTable.type,
      ])
      .limit(5000);

    const a = actions.reduce((acc, value) => {
      const idx = new Date(value.day).toLocaleDateString('');
      if (acc[idx]) {
        acc[idx].count += value.views;
      } else {
        acc[idx] = { count: value.views };
      }
      return acc;
    }, {});

    console.log(a);
  }
}
