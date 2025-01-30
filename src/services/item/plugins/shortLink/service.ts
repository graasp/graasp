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

import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Account } from '../../../account/entities/account';
import { ItemService } from '../../../item/service';
import { Member } from '../../../member/entities/member';
import { ItemPublishedNotFound } from '../publication/published/errors';
import { ItemPublishedService } from '../publication/published/service';
import { ShortLinkDTO } from './dto/ShortLinkDTO';

export const SHORT_LINKS_ROUTE_PREFIX = '/short-links';
export const SHORT_LINKS_LIST_ROUTE = '/list';
export const SHORT_LINKS_FULL_PREFIX = `${ITEMS_ROUTE_PREFIX}${SHORT_LINKS_ROUTE_PREFIX}`;

@singleton()
export class ShortLinkService {
  private itemService: ItemService;
  private itemPublishedService: ItemPublishedService;

  public constructor(itemService: ItemService, itemPublishedService: ItemPublishedService) {
    this.itemService = itemService;
    this.itemPublishedService = itemPublishedService;
  }

  async post(member: Member, repositories: Repositories, shortLink: ShortLink) {
    const { shortLinkRepository } = repositories;

    // check that the item is published if platform is Library
    if (shortLink.platform === ShortLinkPlatform.Library) {
      // Will throw exception if not published or not tagged.
      // Rethrow an ItemPublishedNotFound to indicate that we try
      // to create a short links to the library on an unpublished item.
      try {
        await this.itemPublishedService.get(member, repositories, shortLink.itemId);
      } catch (ex) {
        throw new ItemPublishedNotFound();
      }
    }

    // check that the member can admin the item to be allowed to create short link
    await this.itemService.get(member, repositories, shortLink.itemId, PermissionLevel.Admin);

    const createdShortLink = await shortLinkRepository.addOne(shortLink);
    return ShortLinkDTO.from(createdShortLink);
  }

  async getOne(repositories: Repositories, alias: string) {
    const { shortLinkRepository } = repositories;

    const shortLink = await shortLinkRepository.getOne(alias);
    return ShortLinkDTO.from(shortLink);
  }

  async getAllForItem(account: Account, repositories: Repositories, itemId: string) {
    const { shortLinkRepository } = repositories;

    if (!account) throw new UnauthorizedMember();
    // check that the member can read the item to be allowed to read all short links
    await this.itemService.get(account, repositories, itemId, PermissionLevel.Read);

    const res = await shortLinkRepository.getByItem(itemId);

    return res.reduce<ShortLinksOfItem>((acc, { alias, platform }) => {
      if (acc[platform]) {
        // This should never happen.
        throw new Error(`An alias for the platform "${platform}" already exist!`);
      }

      return { ...acc, [platform]: alias };
    }, {});
  }

  async getRedirection(repositories: Repositories, alias: string) {
    const shortLink = await this.getOne(repositories, alias);
    const clientHostManager = ClientManager.getInstance();

    return clientHostManager.getItemLink(shortLink.platform as Context, shortLink.itemId);
  }

  async delete(member: Member, repositories: Repositories, alias: string) {
    const { shortLinkRepository } = repositories;

    if (!member) throw new UnauthorizedMember();
    const shortLink = await shortLinkRepository.getOne(alias);

    // check that the member can admin the item to be allowed to create short link
    await this.itemService.get(member, repositories, shortLink.item.id, PermissionLevel.Admin);

    await shortLinkRepository.deleteOne(alias);
    return ShortLinkDTO.from(shortLink);
  }

  async update(
    member: Member,
    repositories: Repositories,
    alias: string,
    updatedShortLink: UpdateShortLink,
  ) {
    const { shortLinkRepository } = repositories;
    if (!member) {
      throw new UnauthorizedMember();
    }
    const shortLink = await shortLinkRepository.getOne(alias);

    // check that the member can admin the item to be allowed to create short link
    await this.itemService.get(member, repositories, shortLink.item.id, PermissionLevel.Admin);

    const res = await shortLinkRepository.updateOne(alias, updatedShortLink);
    return ShortLinkDTO.from(res);
  }
}

export default ShortLinkService;
