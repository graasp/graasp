import { FastifyBaseLogger } from 'fastify';

import { ItemTagType, PermissionLevel, UUID } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import type { MailerDecoration } from '../../../../plugins/mailer';
import { MAIL } from '../../../../plugins/mailer/langs/constants';
import { resultOfToList } from '../../../../services/utils';
import { UnauthorizedMember } from '../../../../utils/errors';
import HookManager from '../../../../utils/hook';
import { Repositories } from '../../../../utils/repositories';
import { filterOutHiddenItems } from '../../../authorization';
import { Actor, Member } from '../../../member/entities/member';
import { ItemWrapper } from '../../ItemWrapper';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
import { buildPublishedItemLink } from './constants';
import { ItemPublishedNotFound } from './errors';

interface ActionCount {
  actionCount: number;
}
export class ItemPublishedService {
  private log: FastifyBaseLogger;
  private itemService: ItemService;
  private mailer: MailerDecoration;

  hooks = new HookManager<{
    create: { pre: { item: Item }; post: { item: Item } };
    delete: { pre: { item: Item }; post: { item: Item } };
  }>();

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
      const lang = member.lang ?? DEFAULT_LANG;
      const t = this.mailer.translate(lang);

      const text = t(MAIL.PUBLISH_ITEM_TEXT, { itemName: item.name });
      const html = `
        ${this.mailer.buildText(text)}
        ${this.mailer.buildButton(link, t(MAIL.PUBLISH_ITEM_BUTTON_TEXT))}
      `;
      const title = t(MAIL.PUBLISH_ITEM_TITLE, { itemName: item.name });

      const footer = this.mailer.buildFooter(lang);

      await this.mailer.sendEmail(title, member.email, link, html, footer).catch((err) => {
        this.log.warn(err, `mailer failed. published link: ${link}`);
      });
    }
  }

  async get(actor: Actor, repositories: Repositories, itemId: string) {
    const { itemPublishedRepository, itemTagRepository, actionRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId);

    // item should be public first
    await itemTagRepository.getType(item, ItemTagType.Public, { shouldThrow: true });

    try {
      // get item published entry
      const publishedItem = await itemPublishedRepository.getForItem(item);
      // get views from the actions table
      const totalViews = await actionRepository.getAggregationForItem(item.path, {
        view: 'library',
        types: ['collection-view'],
      });
      return { totalViews: (totalViews?.[0] as ActionCount)?.actionCount, ...publishedItem };
    } catch (err) {
      // when the item is found but it is not published we simply return `null`
      if (err instanceof ItemPublishedNotFound) {
        return null;
      }
      // if the error was not expecte we throw it back
      throw err;
    }
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

  async post(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
    { shouldBePublic = true }: { shouldBePublic: boolean } = { shouldBePublic: true },
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemPublishedRepository, itemTagRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    // item should be public first
    const tag = await itemTagRepository.getType(item, ItemTagType.Public, {
      shouldThrow: shouldBePublic,
    });

    // if the item can be private and be published, set it to public automatically.
    // it's usefull to publish the item automatically after the validation.
    // the user is asked to set the item to public in the frontend.
    if (!tag && !shouldBePublic) {
      await itemTagRepository.post(actor, item, ItemTagType.Public);
    }

    // TODO: check validation is alright

    await this.hooks.runPreHooks('create', actor, repositories, { item });

    const published = await itemPublishedRepository.post(actor, item);

    await this.hooks.runPostHooks('create', actor, repositories, { item });
    //TODO: should we sent a publish hooks for all descendants? If yes take inspiration from delete method in ItemService

    this._notifyContributors(actor, repositories, item);

    return published;
  }

  async delete(actor: Actor, repositories: Repositories, itemId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemPublishedRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    await this.hooks.runPreHooks('delete', actor, repositories, { item });

    const result = itemPublishedRepository.deleteForItem(item);

    await this.hooks.runPostHooks('delete', actor, repositories, { item });

    return result;
  }

  async getItemsForMember(actor: Actor, repositories, memberId: UUID) {
    const { itemRepository } = repositories;
    const items = await itemRepository.getPublishedItemsForMember(memberId);

    return ItemWrapper.createPackedItems(actor, repositories, items);
  }

  async getLikedItems(actor: Actor, repositories: Repositories, limit?: number) {
    const { itemPublishedRepository } = repositories;
    const items = await itemPublishedRepository.getLikedItems(limit);
    return filterOutHiddenItems(repositories, items);
  }

  async getRecentItems(actor: Actor, repositories: Repositories, limit?: number) {
    const { itemPublishedRepository } = repositories;
    const items = await itemPublishedRepository.getRecentItems(limit);

    return filterOutHiddenItems(repositories, items);
  }
}
