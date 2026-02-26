import { and, asc, count, eq } from 'drizzle-orm';

import {
  type ShortLink as CreateShortLink,
  ShortLinkPlatform,
  type UnionOfConst,
  type UpdateShortLink,
} from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { DUPLICATE_ERROR_CODE } from '../../../../drizzle/errorCodes';
import { shortLinksTable } from '../../../../drizzle/schema';
import type {
  ShortLinkInsertDTO,
  ShortLinkRaw,
  ShortLinkWithItem,
} from '../../../../drizzle/types';
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
    dbConnection: DBConnection,
    { alias, platform, itemId }: CreateShortLinkBody,
  ): Promise<ShortLinkRaw> {
    throwsIfParamIsInvalid('alias', alias);
    if ((await this.countByItemAndPlatform(dbConnection, itemId, platform)) > 0) {
      throw new ShortLinkLimitExceed(itemId, platform);
    }

    try {
      const res = await dbConnection
        .insert(shortLinksTable)
        .values({ alias, platform, itemId })
        .returning();

      return res[0];
    } catch (err: unknown) {
      // can throw on alias conflict
      if (
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        err.code === DUPLICATE_ERROR_CODE
      ) {
        throw new ShortLinkDuplication(alias);
      }
      assertIsError(err);
      throw err;
    }
  }

  private async countByItemAndPlatform(
    dbConnection: DBConnection,
    itemId: string,
    platform: UnionOfConst<typeof ShortLinkPlatform>,
  ): Promise<number> {
    throwsIfParamIsInvalid('itemId', itemId);
    throwsIfParamIsInvalid('platform', platform);

    const result = await dbConnection
      .select({ count: count() })
      .from(shortLinksTable)
      .where(and(eq(shortLinksTable.itemId, itemId), eq(shortLinksTable.platform, platform)));

    return result[0].count;
  }

  async getByItem(dbConnection: DBConnection, itemId: string): Promise<ShortLinkRaw[]> {
    throwsIfParamIsInvalid('itemId', itemId);

    return await dbConnection.query.shortLinksTable.findMany({
      where: eq(shortLinksTable.itemId, itemId),
      orderBy: asc(shortLinksTable.createdAt),
    });
  }

  async getOne(dbConnection: DBConnection, alias: string): Promise<ShortLinkWithItem> {
    const shortLink = await dbConnection.query.shortLinksTable.findFirst({
      where: eq(shortLinksTable.alias, alias),
      with: { item: true },
    });

    if (!shortLink) {
      throw new ShortLinkNotFound(alias);
    }

    return shortLink;
  }

  async updateOne(
    dbConnection: DBConnection,
    alias: string,
    entity: UpdateShortLinkBody,
  ): Promise<ShortLinkInsertDTO> {
    // Because we are updating the alias, which is the PK, we cannot use the super.updateOne method.
    throwsIfParamIsInvalid('alias', alias);

    try {
      const res = await dbConnection
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
    } catch (error: unknown) {
      if (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === DUPLICATE_ERROR_CODE
      ) {
        throw new ShortLinkDuplication(entity.alias);
      }
      assertIsError(error);

      throw new UpdateException(error.message);
    }
  }

  async deleteOne(dbConnection: DBConnection, alias: string): Promise<void> {
    await dbConnection.delete(shortLinksTable).where(eq(shortLinksTable.alias, alias)).returning();
  }
}
