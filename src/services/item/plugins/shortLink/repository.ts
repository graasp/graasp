import { EntityManager } from 'typeorm';

import {
  ShortLink as CreateShortLink,
  ShortLinkPlatform,
  UnionOfConst,
  UpdateShortLink,
} from '@graasp/sdk';

import { MutableRepository } from '../../../../repositories/MutableRepository';
import {
  EntryNotFoundAfterUpdateException,
  UpdateException,
} from '../../../../repositories/errors';
import { assertIsError } from '../../../../utils/assertions';
import {
  ShortLinkDuplication,
  ShortLinkLimitExceed,
  ShortLinkNotFound,
} from '../../../../utils/errors';
import { isDuplicateEntryError } from '../../../../utils/typeormError';
import { ShortLink } from './entities/ShortLink';

type CreateShortLinkBody = CreateShortLink;
type UpdateShortLinkBody = UpdateShortLink;
const PRIMARY_KEY = 'alias';

export class ShortLinkRepository extends MutableRepository<ShortLink, UpdateShortLinkBody> {
  constructor(manager?: EntityManager) {
    super(PRIMARY_KEY, ShortLink, manager);
  }

  async addOne({ alias, platform, itemId }: CreateShortLinkBody): Promise<ShortLink> {
    super.throwsIfPKIsInvalid(alias);
    if ((await this.countByItemAndPlatform(itemId, platform)) > 0) {
      throw new ShortLinkLimitExceed(itemId, platform);
    }

    try {
      return await super.insert({ alias, platform, item: { id: itemId } });
    } catch (e) {
      assertIsError(e);
      if (isDuplicateEntryError(e)) {
        throw new ShortLinkDuplication(alias);
      }
      throw e;
    }
  }

  private async countByItemAndPlatform(
    itemId: string,
    platform: UnionOfConst<typeof ShortLinkPlatform>,
  ): Promise<number> {
    super.throwsIfParamIsInvalid('itemId', itemId);
    super.throwsIfParamIsInvalid('platform', platform);

    return await this.repository.count({
      where: {
        item: {
          id: itemId,
        },
        platform,
      },
    });
  }

  async getByItem(itemId: string): Promise<ShortLink[]> {
    super.throwsIfParamIsInvalid('itemId', itemId);

    return await this.repository.find({
      where: {
        item: {
          id: itemId,
        },
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async getOne(alias: string): Promise<ShortLink> {
    const shortLink = await super.findOne(alias, {
      relations: {
        item: true,
      },
    });

    if (!shortLink) {
      throw new ShortLinkNotFound(alias);
    }

    return shortLink;
  }

  async updateOne(alias: string, entity: UpdateShortLinkBody): Promise<ShortLink> {
    // Because we are updating the alias, which is the PK, we cannot use the super.updateOne method.
    this.throwsIfPKIsInvalid(alias);

    try {
      await this.repository.update({ alias }, entity);

      const updatedEntity = await this.getOne(entity.alias);

      // Could happen if the given pk doesn't exist, because update does not check if entity exists.
      if (!updatedEntity) {
        throw new EntryNotFoundAfterUpdateException(this.entity);
      }

      return updatedEntity;
    } catch (e) {
      assertIsError(e);
      if (isDuplicateEntryError(e)) {
        throw new ShortLinkDuplication(alias);
      }
      if (e instanceof EntryNotFoundAfterUpdateException) {
        throw e;
      }
      throw new UpdateException(e.message);
    }
  }
}
