import { ShortLinkPatchPayload, ShortLinkPostPayload } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource.js';
import {
  ItemNotFound,
  ShortLinkDuplication,
  ShortLinkLimitExceed,
  ShortLinkNotFound,
} from '../../../../utils/errors.js';
import { isDuplicateEntryError } from '../../../../utils/typeormError.js';
import { ShortLink } from './entities/ShortLink.js';

export const ShortLinkRepository = AppDataSource.getRepository(ShortLink).extend({
  async createOne(postLink: ShortLinkPostPayload): Promise<ShortLink> {
    const { alias, platform, itemId } = postLink;
    const shortLink = this.create({
      alias,
      platform,
      item: { id: itemId },
    });

    try {
      const shortLinks = await this.getItem(itemId);
      const platformLinks = shortLinks.filter((link: ShortLink) => link.platform === platform);

      if (platformLinks.length > 0) {
        throw new ShortLinkLimitExceed(itemId, platform);
      }
      await this.insert(shortLink);

      return shortLink;
    } catch (e) {
      if (isDuplicateEntryError(e)) {
        throw new ShortLinkDuplication(alias);
      }
      throw e;
    }
  },

  async getItem(itemId: string): Promise<ShortLink[]> {
    if (!itemId) throw new ItemNotFound();

    const shortLinks = await this.find({
      where: {
        item: {
          id: itemId,
        },
      },
      order: {
        createdAt: 'ASC',
      },
    });

    return shortLinks;
  },

  async get(alias: string): Promise<ShortLink> {
    if (!alias) throw new ShortLinkNotFound(alias);

    const shortLink = await this.findOne({
      where: { alias },
      relations: {
        item: true,
      },
    });

    if (!shortLink) throw new ShortLinkNotFound(alias);

    return shortLink;
  },

  async getWithoutJoin(alias: string): Promise<ShortLink> {
    if (!alias) throw new ShortLinkNotFound(alias);

    const shortLink = await this.findOne({
      where: { alias },
      select: ShortLink.getAllColumns(AppDataSource.manager),
    });

    if (!shortLink) throw new ShortLinkNotFound(alias);

    return shortLink;
  },

  async deleteOne(alias: string): Promise<ShortLink> {
    const shortLink = await this.get(alias);
    await this.delete(alias);
    return shortLink;
  },

  async updateOne(alias: string, postLink: ShortLinkPatchPayload): Promise<ShortLink> {
    try {
      if (!alias) throw new ShortLinkNotFound(alias);

      await this.update(alias, postLink);
      const aliasId = postLink['alias'] ?? alias;
      return await this.get(aliasId); // return the updated short link
    } catch (e) {
      // if a duplication entry error throw, the postlink must contain the alias
      if (isDuplicateEntryError(e)) {
        throw new ShortLinkDuplication(postLink['alias']);
      }
      throw e;
    }
  },
});
