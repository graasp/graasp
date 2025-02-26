import { count } from 'console';
import { and, desc, eq, sql } from 'drizzle-orm/sql';

import { AuthTokenSubject } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { apps, items } from '../../../../drizzle/schema';
import { InvalidApplicationOrigin } from './errors';

export class AppRepository {
  async getAll(db: DBConnection, publisherId?: string) {
    // undefined should get all
    return await db.query.apps.findMany({ where: eq(apps.publisherId, publisherId) });
  }

  async getMostUsedApps(
    db: DBConnection,
    memberId: string,
  ): Promise<{ url: string; name: string; count: number }[]> {
    const data = await db
      .select({ url: apps.url, name: apps.name, count: count(items.id) })
      .from(apps)
      .innerJoin(
        items,
        and(eq(sql`${items.extra}::json->'app'->>'url'`, apps.url), eq(items.creatorId, memberId)),
      )
      .groupBy([apps.id, apps.url, apps.name])
      .orderBy(desc(sql.raw('count')));

    return data;
  }

  async isValidAppOrigin(db: DBConnection, appDetails: { key: string; origin: string }) {
    const valid = await db.query.apps.findFirst({
      where: eq(apps.key, appDetails.key),
      with: {
        publisher: {
          where: (p, { inArray }) => inArray(appDetails.origin, p.origins),
        },
      },
    });
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
