import { and, arrayContains, count, desc, eq, sql } from 'drizzle-orm/sql';

import { AuthTokenSubject } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { appsTable, items, publishersTable } from '../../../../drizzle/schema';
import { AppRaw } from '../../../../drizzle/types';
import { InvalidApplicationOrigin } from './errors';

export class AppRepository {
  async getAll(dbConnection: DBConnection, publisherId: string): Promise<AppRaw[]> {
    return await dbConnection.query.appsTable.findMany({
      where: eq(appsTable.publisherId, publisherId),
    });
  }

  async getMostUsedApps(
    dbConnection: DBConnection,
    memberId: string,
  ): Promise<{ url: string; name: string; count: number }[]> {
    const data = await dbConnection
      .select({ url: appsTable.url, name: appsTable.name, count: count(items.id) })
      .from(appsTable)
      .innerJoin(
        items,
        and(
          eq(sql`${items.extra}::json->'app'->>'url'`, appsTable.url),
          eq(items.creatorId, memberId),
        ),
      )
      .groupBy(appsTable.id)
      .orderBy(desc(sql.raw('count')));

    return data;
  }

  async isValidAppOrigin(
    dbConnection: DBConnection,
    appDetails: { key: string; origin: string },
  ): Promise<void> {
    const valid = await dbConnection
      .select()
      .from(appsTable)
      .where(eq(appsTable.key, appDetails.key))
      .rightJoin(
        publishersTable,
        and(
          eq(publishersTable.id, appsTable.publisherId),
          arrayContains(publishersTable.origins, [appDetails.origin]),
        ),
      );
    if (!valid) {
      throw new InvalidApplicationOrigin();
    }
  }

  generateApiAccessTokenSubject(
    accountId: string | undefined,
    itemId: string,
    appDetails: { key: string; origin: string },
  ): AuthTokenSubject {
    return {
      accountId,
      itemId,
      key: appDetails.key, // useful??
      origin: appDetails.origin,
    };
  }
}
