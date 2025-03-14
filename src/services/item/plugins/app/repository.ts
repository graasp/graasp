import { and, arrayContains, count, desc, eq, sql } from 'drizzle-orm/sql';

import { AuthTokenSubject } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db.js';
import { apps, items, publishers } from '../../../../drizzle/schema.js';
import { AppRaw } from '../../../../drizzle/types.js';
import { InvalidApplicationOrigin } from './errors.js';

export class AppRepository {
  async getAll(db: DBConnection, publisherId: string): Promise<AppRaw[]> {
    return await db.query.apps.findMany({
      where: eq(apps.publisherId, publisherId),
    });
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
      // TODO: verify
      .groupBy(apps.id)
      // .groupBy((t) => [t.id, t.url, t.name])
      .orderBy(desc(sql.raw('count')));

    return data;
  }

  async isValidAppOrigin(
    db: DBConnection,
    appDetails: { key: string; origin: string },
  ): Promise<void> {
    const valid = await db
      .select()
      .from(apps)
      .where(eq(apps.key, appDetails.key))
      .rightJoin(
        publishers,
        and(
          eq(publishers.id, apps.publisherId),
          arrayContains(publishers.origins, [appDetails.origin]),
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
