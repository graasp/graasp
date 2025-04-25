import { format } from 'date-fns';
import { count, desc, getTableColumns, gte, inArray, lte, sql } from 'drizzle-orm';
import { and } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import { isDescendantOrSelf } from '../../../../drizzle/operations';
import { actionsTable, itemsRawTable } from '../../../../drizzle/schema';
import { ItemRaw } from '../../../../drizzle/types';
import { MaybeUser } from '../../../../types';

@singleton()
export class ItemActionRepository {
  private sanitizeName(name: string) {
    // remove useless spacing
    return name.trim().replace(/ +(?= )/g, '');
  }

  async getActionsByHour(
    dbConnection: DBConnection,
    itemPath: ItemRaw['path'],
    actor: MaybeUser,
    params: { startDate: string; endDate: string },
  ): Promise<{
    [hour: number]: {
      count: {
        all: number;
        [actionType: string]: number;
      };
      personal: {
        all: number;
        [actionType: string]: number;
      };
    };
  }> {
    const { startDate, endDate } = params;

    const itemAndDescendants = dbConnection
      .select({ id: itemsRawTable.id })
      .from(itemsRawTable)
      .where(isDescendantOrSelf(itemsRawTable.path, itemPath));

    const subActions = dbConnection
      .select()
      .from(actionsTable)
      .where(
        and(
          inArray(actionsTable.itemId, itemAndDescendants),
          gte(actionsTable.createdAt, startDate),
          lte(actionsTable.createdAt, endDate),
        ),
      )
      .orderBy(desc(actionsTable.createdAt))
      .limit(5000)
      .as('subActions');

    const actions = await dbConnection
      .select({
        hour: sql<number>`extract(hour from ${subActions.createdAt})`,
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

    const result = actions.reduce((acc, value) => {
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

    return result;
  }

  async getActionsByDay(
    dbConnection: DBConnection,
    itemPath: ItemRaw['path'],
    actor: MaybeUser,
    params,
  ): Promise<{
    [day: string]: {
      count: {
        all: number;
        [actionType: string]: number;
      };
      personal: {
        all: number;
        [actionType: string]: number;
      };
    };
  }> {
    const { startDate, endDate } = params;

    const itemAndDescendants = dbConnection
      .select({ id: itemsRawTable.id })
      .from(itemsRawTable)
      .where(isDescendantOrSelf(itemsRawTable.path, itemPath));

    const subActions = dbConnection
      .select()
      .from(actionsTable)
      .where(
        and(
          inArray(actionsTable.itemId, itemAndDescendants),
          gte(actionsTable.createdAt, startDate),
          lte(actionsTable.createdAt, endDate),
        ),
      )
      .orderBy(desc(actionsTable.createdAt))
      .limit(5000)
      .as('subActions');

    const actions = await dbConnection
      .select({
        day: sql<string>`date_trunc('day', ${subActions.createdAt})`,
        accountId: subActions.accountId,
        type: subActions.type,
        count: count(),
      })
      .from(subActions)
      .groupBy(() => [
        sql`date_trunc('day', ${subActions.createdAt})`,
        subActions.accountId,
        subActions.type,
      ]);

    const result = actions.reduce((acc, value) => {
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

    return result;
  }

  async getActionsByWeekday(
    dbConnection: DBConnection,
    itemPath: ItemRaw['path'],
    actor: MaybeUser,
    params,
  ): Promise<{
    [weekday: number]: {
      count: {
        all: number;
        [actionType: string]: number;
      };
      personal: {
        all: number;
        [actionType: string]: number;
      };
    };
  }> {
    const { startDate, endDate } = params;

    const itemAndDescendants = dbConnection
      .select({ id: itemsRawTable.id })
      .from(itemsRawTable)
      .where(isDescendantOrSelf(itemsRawTable.path, itemPath));

    const subActions = dbConnection
      .select(getTableColumns(actionsTable))
      .from(actionsTable)
      .where(
        and(
          inArray(actionsTable.itemId, itemAndDescendants),
          gte(actionsTable.createdAt, startDate),
          lte(actionsTable.createdAt, endDate),
        ),
      )
      .orderBy(desc(actionsTable.createdAt))
      .limit(5000)
      .as('subActions');

    const actions = await dbConnection
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

    const result = actions.reduce((acc, value) => {
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

    return result;
  }
}
