import { singleton } from 'tsyringe';

import {
  ClientManager,
  Context,
  PermissionLevel,
  ShortLink,
  ShortLinkPlatform,
  ShortLinksOfItem,
  UpdateShortLink,
} from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { UnauthorizedMember } from '../../../../utils/errors';
import { Account } from '../../../account/entities/account';
import { ItemService } from '../../../item/service';
import { Member } from '../../../member/entities/member';
import { ItemPublishedNotFound } from '../publication/published/errors';
import { ItemPublishedService } from '../publication/published/service';
import { ShortLinkDTO } from './dto/ShortLinkDTO';
import { ShortLinkRepository } from './repository';

export const SHORT_LINKS_ROUTE_PREFIX = '/short-links';
export const SHORT_LINKS_LIST_ROUTE = '/list';
export const SHORT_LINKS_FULL_PREFIX = `${ITEMS_ROUTE_PREFIX}${SHORT_LINKS_ROUTE_PREFIX}`;

@singleton()
export class ShortLinkService {
  private itemService: ItemService;
  private itemPublishedService: ItemPublishedService;
  private readonly shortLinkRepository: ShortLinkRepository;

  public constructor(
    itemService: ItemService,
    itemPublishedService: ItemPublishedService,
    shortLinkRepository: ShortLinkRepository,
  ) {
    this.itemService = itemService;
    this.itemPublishedService = itemPublishedService;
    this.shortLinkRepository = shortLinkRepository;
  }

  async post(db: DBConnection, member: Member, shortLink: ShortLink) {
    // check that the item is published if platform is Library
    if (shortLink.platform === ShortLinkPlatform.Library) {
      // Will throw exception if not published or not tagged.
      // Rethrow an ItemPublishedNotFound to indicate that we try
      // to create a short links to the library on an unpublished item.
      try {
        await this.itemPublishedService.get(db, member, shortLink.itemId);
      } catch (ex) {
        throw new ItemPublishedNotFound();
      }
    }

    // check that the member can admin the item to be allowed to create short link
    await this.itemService.get(db, member, shortLink.itemId, PermissionLevel.Admin);

    const createdShortLink = await this.shortLinkRepository.addOne(db, shortLink);
    return ShortLinkDTO.from(createdShortLink);
  }

  async getOne(db: DBConnection, alias: string) {
    const shortLink = await this.shortLinkRepository.getOne(db, alias);
    return ShortLinkDTO.from(shortLink);
  }

  async getAllForItem(db: DBConnection, account: Account, itemId: string) {
    if (!account) throw new UnauthorizedMember();
    // check that the member can read the item to be allowed to read all short links
    await this.itemService.get(db, account, itemId, PermissionLevel.Read);

    const res = await this.shortLinkRepository.getByItem(db, itemId);

    return res.reduce<ShortLinksOfItem>((acc, { alias, platform }) => {
      if (acc[platform]) {
        // This should never happen.
        throw new Error(`An alias for the platform "${platform}" already exist!`);
      }

      return { ...acc, [platform]: alias };
    }, {});
  }

  async getRedirection(db: DBConnection, alias: string) {
    const shortLink = await this.getOne(db, alias);
    const clientHostManager = ClientManager.getInstance();

    return clientHostManager.getItemLink(shortLink.platform as Context, shortLink.itemId);
  }

  async delete(db: DBConnection, member: Member, alias: string) {
    if (!member) throw new UnauthorizedMember();
    const shortLink = await this.shortLinkRepository.getOne(db, alias);

    // check that the member can admin the item to be allowed to create short link
    await this.itemService.get(db, member, shortLink.item.id, PermissionLevel.Admin);

    await this.shortLinkRepository.deleteOne(db, alias);
    return ShortLinkDTO.from(shortLink);
  }

  async update(db: DBConnection, member: Member, alias: string, updatedShortLink: UpdateShortLink) {
    if (!member) {
      throw new UnauthorizedMember();
    }
    const shortLink = await this.shortLinkRepository.getOne(db, alias);

    // check that the member can admin the item to be allowed to create short link
    await this.itemService.get(db, member, shortLink.item.id, PermissionLevel.Admin);

    const res = await this.shortLinkRepository.updateOne(db, alias, updatedShortLink);
    return ShortLinkDTO.from(res);
  }
}

export default ShortLinkService;
