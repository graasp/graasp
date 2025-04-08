import { format } from 'date-fns';
import { count, desc, gte, lte, sql } from 'drizzle-orm';
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

  async getActionsByHour(
    db: DBConnection,
    itemId: Item['id'],
    actor: MaybeUser,
    params,
  ): Promise<any> {
    const { startDate, endDate, view } = params;

    const subActions = db
      .select()
      .from(actionsTable)
      .where(
        and(
          eq(actionsTable.itemId, itemId),
          // gte(actionsTable.createdAt, startDate),
          // lte(actionsTable.createdAt, endDate),
          // eq(actionsTable.view, view),
        ),
      )
      .orderBy(desc(actionsTable.createdAt))
      .limit(5000)
      .as('subActions');

    const actions = await db
      .select({
        hour: sql<string>`extract(hour from ${subActions.createdAt})`,
        accountId: subActions.accountId,
        type: subActions.type,
        count: count(),
      })
      .from(subActions)
      .groupBy(() => [
        sql`extract(hour from ${subActions.createdAt})`,
        subActions.accountId,
        subActions.type,
      ]);

    const a = actions.reduce((acc, value) => {
      const { type, count, hour: idx } = value;

      acc[idx] = {
        hour: idx,
        count: Object.assign(acc[idx]?.count ?? {}, {
          all: (acc[idx]?.count?.all ?? 0) + count,
          [type]: (acc[idx]?.count?.[type] ?? 0) + count,
        }),
        personal:
          actor && actor.id === value.accountId
            ? Object.assign(acc[idx]?.personal ?? {}, {
                all: (acc[idx]?.personal?.all ?? 0) + count,
                [type]: (acc[idx]?.personal?.[type] ?? 0) + count,
              })
            : (acc[idx]?.personal ?? {}),
      };
      return acc;
    }, {});

    return a;
  }

  async getActionsByDay(
    db: DBConnection,
    itemId: Item['id'],
    actor: MaybeUser,
    params,
  ): Promise<any> {
    const { startDate, endDate, view } = params;

    const subActions = db
      .select()
      .from(actionsTable)
      .where(
        and(
          eq(actionsTable.itemId, itemId),
          // gte(actionsTable.createdAt, startDate),
          // lte(actionsTable.createdAt, endDate),
          // eq(actionsTable.view, view),
        ),
      )
      .orderBy(desc(actionsTable.createdAt))
      .limit(5000)
      .as('subActions');

    const actions = await db
      .select({
        day: sql<string>`date_trunc('day', ${subActions.createdAt})`,
        accountId: subActions.accountId,
        type: subActions.type,
        count: count(),
      })
      .from(subActions)
      .where(
        and(
          eq(subActions.itemId, itemId),
          // gte(actionsTable.createdAt, startDate),
          // lte(actionsTable.createdAt, endDate),
          // eq(actionsTable.view, view),
        ),
      )
      .groupBy(() => [
        sql`date_trunc('day', ${subActions.createdAt})`,
        subActions.accountId,
        subActions.type,
      ]);

    const a = actions.reduce((acc, value) => {
      const idx = format(value.day, 'yyyy/MM/dd');
      const { type, count } = value;

      acc[idx] = {
        date: idx,
        count: Object.assign(acc[idx]?.count ?? {}, {
          all: (acc[idx]?.count?.all ?? 0) + count,
          [type]: (acc[idx]?.count?.[type] ?? 0) + count,
        }),
        personal:
          actor && actor.id === value.accountId
            ? Object.assign(acc[idx]?.personal ?? {}, {
                all: (acc[idx]?.personal?.all ?? 0) + count,
                [type]: (acc[idx]?.personal?.[type] ?? 0) + count,
              })
            : (acc[idx]?.personal ?? {}),
      };
      return acc;
    }, {});

    return a;
  }

  async getActionsByWeekday(
    db: DBConnection,
    itemId: Item['id'],
    actor: MaybeUser,
    params,
  ): Promise<any> {
    const { startDate, endDate, view } = params;

    const subActions = db
      .select()
      .from(actionsTable)
      .where(
        and(
          eq(actionsTable.itemId, itemId),
          // gte(actionsTable.createdAt, startDate),
          // lte(actionsTable.createdAt, endDate),
          // eq(actionsTable.view, view),
        ),
      )
      .orderBy(desc(actionsTable.createdAt))
      .limit(5000)
      .as('subActions');

    const actions = await db
      .select({
        day: sql<number>`extract(dow from ${subActions.createdAt})`,
        accountId: subActions.accountId,
        type: subActions.type,
        count: count(),
      })
      .from(subActions)
      .groupBy(() => [
        sql`extract(dow from ${subActions.createdAt})`,
        subActions.accountId,
        subActions.type,
      ]);

    const a = actions.reduce((acc, value) => {
      const { type, count, day: idx } = value;

      acc[idx] = {
        weekday: idx,
        count: Object.assign(acc[idx]?.count ?? {}, {
          all: (acc[idx]?.count?.all ?? 0) + count,
          [type]: (acc[idx]?.count?.[type] ?? 0) + count,
        }),
        personal:
          actor && actor.id === value.accountId
            ? Object.assign(acc[idx]?.personal ?? {}, {
                all: (acc[idx]?.personal?.all ?? 0) + count,
                [type]: (acc[idx]?.personal?.[type] ?? 0) + count,
              })
            : (acc[idx]?.personal ?? {}),
      };
      return acc;
    }, {});

    return a;
  }
}
