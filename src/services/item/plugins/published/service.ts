import { FastifyBaseLogger } from 'fastify';

import { ItemTagType, PermissionLevel, UUID } from '@graasp/sdk';
import { MAIL } from '@graasp/translations';

import type { MailerDecoration } from '../../../../plugins/mailer';
import { resultOfToList } from '../../../../services/utils';
import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { filterOutHiddenItems } from '../../../authorization';
import { Actor, Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import ItemService from '../../service';
import { buildPublishedItemLink } from './constants';

export class ItemPublishedService {
  private log: FastifyBaseLogger;
  private itemService: ItemService;
  private mailer: MailerDecoration;

  constructor(itemService: ItemService, mailer: MailerDecoration, log) {
    this.log = log;
    this.itemService = itemService;
    this.mailer = mailer;
  }

  async _notifyContributors(actor: Member, repositories: Repositories, item: Item): Promise<void> {
    // send email to contributors except yourself
    const memberships = await repositories.itemMembershipRepository.getForManyItems([item]);
    const contributors = resultOfToList(memberships)[0]
      .filter(
        ({ permission, member }) => permission === PermissionLevel.Admin && member.id !== actor.id,
      )
      .map(({ member }) => member);

    const link = buildPublishedItemLink(item);

    for (const member of contributors) {
      const lang = member.lang;
      const t = this.mailer.translate(lang);

      const text = t(MAIL.PUBLISH_ITEM_TEXT, { itemName: item.name });
      const html = `
        ${this.mailer.buildText(text)}
        ${this.mailer.buildButton(link, t(MAIL.PUBLISH_ITEM_BUTTON_TEXT))}
      `;

      const title = t(MAIL.PUBLISH_ITEM_TITLE, { itemName: item.name });
      await this.mailer.sendEmail(title, member.email, link, html).catch((err) => {
        this.log.warn(err, `mailer failed. published link: ${link}`);
      });
    }
  }

  async get(actor: Actor, repositories: Repositories, itemId: string) {
    const { itemPublishedRepository, itemTagRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId);

    // item should be public first
    await itemTagRepository.getType(item, ItemTagType.Public, { shouldThrow: true });

    return itemPublishedRepository.getForItem(item);
  }

  async getMany(actor: Actor, repositories: Repositories, itemIds: string[]) {
    const { itemPublishedRepository, itemTagRepository } = repositories;

    const { data: itemsMap, errors } = await this.itemService.getMany(actor, repositories, itemIds);

    const items = Object.values(itemsMap);
    // item should be public first
    const { data: areItemsPublic, errors: publicErrors } = await itemTagRepository.hasForMany(
      items,
      ItemTagType.Public,
    );

    const { data: publishedInfo, errors: publishedErrors } =
      await itemPublishedRepository.getForItems(items.filter((i) => areItemsPublic[i.id]));

    return {
      data: publishedInfo,
      errors: [...errors, ...publicErrors, ...publishedErrors],
    };
  }

  async post(actor: Actor, repositories: Repositories, itemId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemPublishedRepository, itemTagRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    // item should be public first
    await itemTagRepository.getType(item, ItemTagType.Public, { shouldThrow: true });

    // TODO: check validation is alright

    const published = await itemPublishedRepository.post(actor, item);

    this._notifyContributors(actor, repositories, item);

    return published;
  }

  async delete(actor: Actor, repositories: Repositories, itemId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemPublishedRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    return itemPublishedRepository.deleteForItem(item);
  }

  async getItemsForMember(actor: Actor, repositories, memberId: UUID) {
    const { itemPublishedRepository } = repositories;
    return itemPublishedRepository.getItemsForMember(memberId);
  }

  // filter out by categories, not defined will return all items
  async getItemsByCategories(actor: Actor, repositories: Repositories, categoryIds?: string[]) {
    const { itemPublishedRepository } = repositories;

    if (!categoryIds?.length) {
      const items = await itemPublishedRepository.getAllItems();
      return filterOutHiddenItems(repositories, items);
    }

    // get by categories
    const items = await itemPublishedRepository.getByCategories(categoryIds);

    return filterOutHiddenItems(repositories, items);
  }
}
