import { singleton } from 'tsyringe';

import {
  ClientManager,
  Context,
  PermissionLevel,
  type ShortLink,
  ShortLinkPlatform,
  type ShortLinksOfItem,
  type UpdateShortLink,
} from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import type { AuthenticatedUser, MinimalMember } from '../../../../types';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { UnauthorizedMember } from '../../../../utils/errors';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemPublishedNotFound } from '../publication/published/errors';
import { ItemPublishedService } from '../publication/published/itemPublished.service';
import { ShortLinkDTO } from './dto/ShortLinkDTO';
import { ShortLinkRepository } from './shortlink.repository';

export const SHORT_LINKS_ROUTE_PREFIX = '/short-links';
export const SHORT_LINKS_LIST_ROUTE = '/list';
export const SHORT_LINKS_FULL_PREFIX = `${ITEMS_ROUTE_PREFIX}${SHORT_LINKS_ROUTE_PREFIX}`;

@singleton()
export class ShortLinkService {
  private authorizedItemService: AuthorizedItemService;
  private itemPublishedService: ItemPublishedService;
  private readonly shortLinkRepository: ShortLinkRepository;

  public constructor(
    authorizedItemService: AuthorizedItemService,
    itemPublishedService: ItemPublishedService,
    shortLinkRepository: ShortLinkRepository,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.itemPublishedService = itemPublishedService;
    this.shortLinkRepository = shortLinkRepository;
  }

  async post(dbConnection: DBConnection, member: MinimalMember, shortLink: ShortLink) {
    // check that the item is published if platform is Library
    if (shortLink.platform === ShortLinkPlatform.Library) {
      // Will throw exception if not published or not tagged.
      // Rethrow an ItemPublishedNotFound to indicate that we try
      // to create a short links to the library on an unpublished item.
      try {
        await this.itemPublishedService.get(dbConnection, member, shortLink.itemId);
      } catch (_e) {
        throw new ItemPublishedNotFound();
      }
    }

    // check that the member can admin the item to be allowed to create short link
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: member.id,
      itemId: shortLink.itemId,
      permission: PermissionLevel.Admin,
    });
    const createdShortLink = await this.shortLinkRepository.addOne(dbConnection, shortLink);

    return ShortLinkDTO.from(createdShortLink);
  }

  async getOne(dbConnection: DBConnection, alias: string) {
    const shortLink = await this.shortLinkRepository.getOne(dbConnection, alias);
    return ShortLinkDTO.from(shortLink);
  }

  async getAllForItem(dbConnection: DBConnection, account: AuthenticatedUser, itemId: string) {
    if (!account) throw new UnauthorizedMember();
    // check that the member can read the item to be allowed to read all short links
    await this.authorizedItemService.getItemById(dbConnection, {
      accountId: account.id,
      itemId,
      permission: PermissionLevel.Read,
    });

    const res = await this.shortLinkRepository.getByItem(dbConnection, itemId);

    return res.reduce<ShortLinksOfItem>((acc, { alias, platform }) => {
      if (acc[platform]) {
        // This should never happen.
        throw new Error(`An alias for the platform "${platform}" already exist!`);
      }

      return { ...acc, [platform]: alias };
    }, {});
  }

  async getRedirection(dbConnection: DBConnection, alias: string) {
    const shortLink = await this.getOne(dbConnection, alias);
    const clientHostManager = ClientManager.getInstance();

    return clientHostManager.getItemLink(shortLink.platform as Context, shortLink.itemId);
  }

  async delete(dbConnection: DBConnection, member: MinimalMember, alias: string) {
    if (!member) throw new UnauthorizedMember();
    const shortLink = await this.shortLinkRepository.getOne(dbConnection, alias);

    // check that the member can admin the item to be allowed to create short link
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: member.id,
      itemId: shortLink.item.id,
      permission: PermissionLevel.Admin,
    });

    await this.shortLinkRepository.deleteOne(dbConnection, alias);
    return ShortLinkDTO.from(shortLink);
  }

  async update(
    dbConnection: DBConnection,
    member: MinimalMember,
    alias: string,
    updatedShortLink: UpdateShortLink,
  ) {
    if (!member) {
      throw new UnauthorizedMember();
    }
    const shortLink = await this.shortLinkRepository.getOne(dbConnection, alias);

    // check that the member can admin the item to be allowed to create short link
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: member.id,
      itemId: shortLink.item.id,
      permission: PermissionLevel.Admin,
    });

    const res = await this.shortLinkRepository.updateOne(dbConnection, alias, updatedShortLink);
    return ShortLinkDTO.from(res);
  }
}

export default ShortLinkService;
