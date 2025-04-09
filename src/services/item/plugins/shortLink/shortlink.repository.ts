import { and, asc, count, eq } from 'drizzle-orm';

import {
  ShortLink as CreateShortLink,
  ShortLinkPlatform,
  UnionOfConst,
  UpdateShortLink,
} from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { DUPLICATE_ERROR_CODE } from '../../../../drizzle/errorCodes';
import { shortLinksTable } from '../../../../drizzle/schema';
import { ShortLinkInsertDTO, ShortLinkRaw, ShortLinkWithItem } from '../../../../drizzle/types';
import { UpdateException } from '../../../../repositories/errors';
import { throwsIfParamIsInvalid } from '../../../../repositories/utils';
import { assertIsError } from '../../../../utils/assertions';
import {
  ShortLinkDuplication,
  ShortLinkLimitExceed,
  ShortLinkNotFound,
} from '../../../../utils/errors';

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
      const res = await db.insert(shortLinksTable).values({ alias, platform, itemId }).returning();

      return res[0];
    } catch (e) {
      // can throw on alias conflict
      if (e.code === DUPLICATE_ERROR_CODE) {
        throw new ShortLinkDuplication(alias);
      }
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
      .from(shortLinksTable)
      .where(and(eq(shortLinksTable.itemId, itemId), eq(shortLinksTable.platform, platform)));

    return result[0].count;
  }

  async getByItem(db: DBConnection, itemId: string): Promise<ShortLinkRaw[]> {
    throwsIfParamIsInvalid('itemId', itemId);

    return await db.query.shortLinksTable.findMany({
      where: eq(shortLinksTable.itemId, itemId),
      orderBy: asc(shortLinksTable.createdAt),
    });
  }

  async getOne(db: DBConnection, alias: string): Promise<ShortLinkWithItem> {
    const shortLink = await db.query.shortLinksTable.findFirst({
      where: eq(shortLinksTable.alias, alias),
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
        .update(shortLinksTable)
        .set(entity)
        .where(eq(shortLinksTable.alias, alias))
        .returning();

      const updatedEntity = res.at(0);
      // Could happen if the given pk doesn't exist, because update does not check if entity exists.
      if (!updatedEntity) {
        throw new Error('entity not found after Update');
      }

      return updatedEntity;
    } catch (e) {
      if (e.code === DUPLICATE_ERROR_CODE) {
        throw new ShortLinkDuplication(entity.alias);
      }
      assertIsError(e);

      throw new UpdateException(e.message);
    }
  }

  async deleteOne(db: DBConnection, alias: string): Promise<void> {
    await db.delete(shortLinksTable).where(eq(shortLinksTable.alias, alias)).returning();
  }
}
