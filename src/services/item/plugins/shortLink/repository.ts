import { EntityManager } from 'typeorm';

import {
  ShortLinkPatchPayload,
  ShortLinkPlatform,
  ShortLinkPostPayload,
  UnionOfConst,
} from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { MutableRepository } from '../../../../repositories/MutableRepository';
import {
  ShortLinkDuplication,
  ShortLinkLimitExceed,
  ShortLinkNotFound,
} from '../../../../utils/errors';
import { isDuplicateEntryError } from '../../../../utils/typeormError';
import { ShortLink } from './entities/ShortLink';

type CreateShortLinkBody = ShortLinkPostPayload;
type UpdateShortLinkBody = ShortLinkPatchPayload;
const PRIMARY_KEY = 'alias';

export class ShortLinkRepository extends MutableRepository<ShortLink, UpdateShortLinkBody> {
  constructor(manager?: EntityManager) {
    super(PRIMARY_KEY, ShortLink, manager);
  }

  async addOne({ alias, platform, itemId }: CreateShortLinkBody): Promise<ShortLink> {
    super.throwsIfPKIsInvalid(alias);
    if ((await this.countByItemAndPlateform(itemId, platform)) > 0) {
      throw new ShortLinkLimitExceed(itemId, platform);
    }

    try {
      return await super.insert({ alias, platform, item: { id: itemId } });
    } catch (e) {
      if (isDuplicateEntryError(e.message)) {
        throw new ShortLinkDuplication(alias);
      }
      throw e;
    }
  }

  private async countByItemAndPlateform(
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

  async getOneFlat(alias: string): Promise<ShortLink> {
    const shortLink = await super.findOne(alias, {
      select: ShortLink.getAllColumns(AppDataSource.manager),
    });

    if (!shortLink) {
      throw new ShortLinkNotFound(alias);
    }

    return shortLink;
  }

  async updateOne(alias: string, entity: UpdateShortLinkBody): Promise<ShortLink> {
    try {
      return await super.updateOne(alias, entity);
    } catch (e) {
      if (isDuplicateEntryError(e.message)) {
        throw new ShortLinkDuplication(alias);
      }
      throw e;
    }
  }
}
