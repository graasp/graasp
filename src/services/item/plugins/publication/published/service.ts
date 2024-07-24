import { formatISO } from 'date-fns';
import { singleton } from 'tsyringe';

import { ItemTagType, PermissionLevel, PublishableItemTypeChecker, UUID } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { BaseLogger } from '../../../../../logger';
import { MAIL } from '../../../../../plugins/mailer/langs/constants';
import { MailerService } from '../../../../../plugins/mailer/service';
import { resultOfToList } from '../../../../../services/utils';
import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { filterOutHiddenItems } from '../../../../authorization';
import { Actor, Member } from '../../../../member/entities/member';
import { ItemWrapper } from '../../../ItemWrapper';
import { Item } from '../../../entities/Item';
import { ItemService } from '../../../service';
import { buildPublishedItemLink } from './constants';
import { ItemTypeNotAllowedToPublish } from './errors';

interface ActionCount {
  actionCount: number;
}

@singleton()
export class ItemPublishedService {
  private log: BaseLogger;
  private itemService: ItemService;
  private mailerService: MailerService;

  hooks = new HookManager<{
    create: { pre: { item: Item }; post: { item: Item } };
    delete: { pre: { item: Item }; post: { item: Item } };
  }>();

  constructor(itemService: ItemService, mailerService: MailerService, log: BaseLogger) {
    this.log = log;
    this.itemService = itemService;
    this.mailerService = mailerService;
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
      const t = this.mailerService.translate(lang);

      const text = t(MAIL.PUBLISH_ITEM_TEXT, { itemName: item.name });
      const html = `
        ${this.mailerService.buildText(text)}
        ${this.mailerService.buildButton(link, t(MAIL.PUBLISH_ITEM_BUTTON_TEXT))}
      `;
      const title = t(MAIL.PUBLISH_ITEM_TITLE, { itemName: item.name });

      const footer = this.mailerService.buildFooter(lang);

      await this.mailerService.sendEmail(title, member.email, link, html, footer).catch((err) => {
        this.log.warn(err, `mailerService failed. published link: ${link}`);
      });
    }
  }

  async get(actor: Actor, repositories: Repositories, itemId: string) {
    const { itemPublishedRepository, itemTagRepository, actionRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId);

    // item should be public first
    await itemTagRepository.getType(item, ItemTagType.Public, { shouldThrow: true });

    // get item published entry
    const publishedItem = await itemPublishedRepository.getForItem(item);

    if (!publishedItem) {
      return null;
    }
    // get views from the actions table
    const totalViews = await actionRepository.getAggregationForItem(item.path, {
      view: 'library',
      types: ['collection-view'],
      startDate: formatISO(publishedItem.createdAt),
      endDate: formatISO(new Date()),
    });
    return { totalViews: (totalViews?.[0] as ActionCount)?.actionCount, ...publishedItem };
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

  async publishIfNotExist(member: Member, repositories: Repositories, itemId: string) {
    const { itemPublishedRepository } = repositories;

    const item = await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    const itemPublished = await itemPublishedRepository.getForItem(item);

    if (itemPublished) {
      return itemPublished;
    }

    return await this.post(member, repositories, item, { canBePrivate: true });
  }

  async post(
    member: Member,
    repositories: Repositories,
    item: Item,
    { canBePrivate }: { canBePrivate?: boolean } = {},
  ) {
    const { itemPublishedRepository, itemTagRepository } = repositories;

    if (!PublishableItemTypeChecker.isItemTypeAllowedToBePublished(item.type)) {
      throw new ItemTypeNotAllowedToPublish(item.id, item.type);
    }

    // item should be public first
    const tag = await itemTagRepository.getType(item, ItemTagType.Public, {
      shouldThrow: !canBePrivate,
    });

    // if the item can be private and be published, set it to public automatically.
    // it's usefull to publish the item automatically after the validation.
    // the user is asked to set the item to public in the frontend.
    if (!tag && canBePrivate) {
      await itemTagRepository.post(member, item, ItemTagType.Public);
    }

    // TODO: check validation is alright

    await this.hooks.runPreHooks('create', member, repositories, { item });

    const published = await itemPublishedRepository.post(member, item);

    await this.hooks.runPostHooks('create', member, repositories, { item });
    //TODO: should we sent a publish hooks for all descendants? If yes take inspiration from delete method in ItemService

    this._notifyContributors(member, repositories, item);

    return published;
  }

  async delete(actor: Member, repositories: Repositories, itemId: string) {
    const { itemPublishedRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    await this.hooks.runPreHooks('delete', actor, repositories, { item });

    const result = await itemPublishedRepository.deleteForItem(item);

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
