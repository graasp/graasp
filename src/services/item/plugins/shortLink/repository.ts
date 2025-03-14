import { and, asc, count, eq } from 'drizzle-orm';

import {
  ShortLink as CreateShortLink,
  ShortLinkPlatform,
  UnionOfConst,
  UpdateShortLink,
} from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db.js';
import { shortLinks } from '../../../../drizzle/schema.js';
import { ShortLinkInsertDTO, ShortLinkRaw, ShortLinkWithItem } from '../../../../drizzle/types.js';
import { UpdateException } from '../../../../repositories/errors.js';
import { throwsIfParamIsInvalid } from '../../../../repositories/utils.js';
import { assertIsError } from '../../../../utils/assertions.js';
import { ShortLinkLimitExceed, ShortLinkNotFound } from '../../../../utils/errors.js';

type CreateShortLinkBody = CreateShortLink;
type UpdateShortLinkBody = UpdateShortLink;

export class ShortLinkRepository {
  async addOne(
    db: DBConnection,
    { alias, platform, itemId }: CreateShortLinkBody,
  ): Promise<ShortLinkRaw> {
    throwsIfParamIsInvalid('alias', alias);
    if ((await this.countByItemAndPlatform(db, itemId, platform)) > 0) {
      throw new ShortLinkLimitExceed(itemId, platform);
    }

    try {
      const res = await db
        .insert(shortLinks)
        .values({ alias, platform, itemId })
        .onConflictDoNothing()
        .returning();

      return res[0];
    } catch (e) {
      assertIsError(e);
      throw e;
    }
  }

  private async countByItemAndPlatform(
    db: DBConnection,
    itemId: string,
    platform: UnionOfConst<typeof ShortLinkPlatform>,
  ): Promise<number> {
    throwsIfParamIsInvalid('itemId', itemId);
    throwsIfParamIsInvalid('platform', platform);

    const result = await db
      .select({ count: count() })
      .from(shortLinks)
      .where(and(eq(shortLinks.itemId, itemId), eq(shortLinks.platform, platform)));

    return result[0].count;
  }

  async getByItem(db: DBConnection, itemId: string): Promise<ShortLinkRaw[]> {
    throwsIfParamIsInvalid('itemId', itemId);

    return await db.query.shortLinks.findMany({
      where: eq(shortLinks.itemId, itemId),
      orderBy: asc(shortLinks.createdAt),
    });
  }

  async getOne(db: DBConnection, alias: string): Promise<ShortLinkWithItem> {
    const shortLink = await db.query.shortLinks.findFirst({
      where: eq(shortLinks.alias, alias),
      with: { item: true },
    });

    if (!shortLink) {
      throw new ShortLinkNotFound(alias);
    }

    return shortLink;
  }

  async updateOne(
    db: DBConnection,
    alias: string,
    entity: UpdateShortLinkBody,
  ): Promise<ShortLinkInsertDTO> {
    // Because we are updating the alias, which is the PK, we cannot use the super.updateOne method.
    throwsIfParamIsInvalid('alias', alias);

    try {
      const res = await db
        .update(shortLinks)
        .set(entity)
        .where(eq(shortLinks.alias, alias))
        .returning();

      const updatedEntity = res.at(0);
      // Could happen if the given pk doesn't exist, because update does not check if entity exists.
      if (!updatedEntity) {
        throw new Error('entity not found after Update');
      }

      return updatedEntity;
    } catch (e) {
      assertIsError(e);

      throw new UpdateException(e.message);
    }
  }

  async deleteOne(db: DBConnection, alias: string): Promise<void> {
    await db.delete(shortLinks).where(eq(shortLinks.alias, alias)).returning();
  }
}
