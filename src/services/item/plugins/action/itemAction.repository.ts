import { format } from 'date-fns';
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
        count: count(),
      })
      .from(actionsTable)
      .where(eq(actionsTable.itemId, itemId))
      .groupBy(() => [
        sql`date_trunc('day', ${actionsTable.createdAt})`,
        actionsTable.accountId,
        actionsTable.type,
      ])
      .limit(5000);

    console.log(actions);

    const a = actions.reduce((acc, value) => {
      const idx = format(value.day, 'yyyy/MM/dd');
      const { type, count } = value;

      acc[idx] = {
        count: Object.assign(acc[idx]?.count ?? {}, {
          [type]: (acc[idx]?.count?.[type] ?? 0) + count,
        }),
        personal:
          actor && actor.id === value.accountId
            ? Object.assign(acc[idx]?.personal ?? {}, {
                [type]: (acc[idx]?.personal?.[type] ?? 0) + count,
              })
            : (acc[idx]?.personal ?? {}),
      };
      return acc;
    }, {});

    console.log(a);
  }
}
