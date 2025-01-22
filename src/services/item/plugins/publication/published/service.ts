import { formatISO } from 'date-fns';
import { singleton } from 'tsyringe';

import { ItemVisibilityType, PermissionLevel, PublicationStatus, UUID } from '@graasp/sdk';

import { BaseLogger } from '../../../../../logger';
import { MailBuilder } from '../../../../../plugins/mailer/builder';
import { MAIL } from '../../../../../plugins/mailer/langs/constants';
import { MailerService } from '../../../../../plugins/mailer/service';
import { resultOfToList } from '../../../../../services/utils';
import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { filterOutHiddenItems } from '../../../../authorization';
import { Actor, Member, isMember } from '../../../../member/entities/member';
import { ItemWrapper } from '../../../ItemWrapper';
import { Item } from '../../../entities/Item';
import { ItemService } from '../../../service';
import { ItemThumbnailService } from '../../thumbnail/service';
import { buildPublishedItemLink } from './constants';
import { ItemPublished } from './entities/itemPublished';
import {
  ItemIsNotValidated,
  ItemPublicationAlreadyExists,
  ItemTypeNotAllowedToPublish,
} from './errors';
import { MeiliSearchWrapper } from './plugins/search/meilisearch';

interface ActionCount {
  actionCount: number;
}

@singleton()
export class ItemPublishedService {
  private readonly log: BaseLogger;
  private readonly itemService: ItemService;
  private readonly itemThumbnailService: ItemThumbnailService;
  private readonly meilisearchWrapper: MeiliSearchWrapper;
  private readonly mailerService: MailerService;

  hooks = new HookManager<{
    create: { pre: { item: Item }; post: { published: ItemPublished; item: Item } };
    delete: { pre: { item: Item }; post: { item: Item } };
  }>();

  constructor(
    itemService: ItemService,
    itemThumbnailService: ItemThumbnailService,
    mailerService: MailerService,
    meilisearchWrapper: MeiliSearchWrapper,
    log: BaseLogger,
  ) {
    this.log = log;
    this.itemService = itemService;
    this.itemThumbnailService = itemThumbnailService;
    this.meilisearchWrapper = meilisearchWrapper;
    this.mailerService = mailerService;
  }

  async _notifyContributors(actor: Member, repositories: Repositories, item: Item): Promise<void> {
    // send email to contributors except yourself
    const memberships = await repositories.itemMembershipRepository.getForManyItems([item]);
    const contributors = resultOfToList(memberships)[0]
      .filter(
        ({ permission, account }) =>
          permission === PermissionLevel.Admin && account.id !== actor.id,
      )
      .map(({ account }) => account);

    const link = buildPublishedItemLink(item);

    for (const member of contributors) {
      if (isMember(member)) {
        const mail = new MailBuilder({
          subject: {
            text: MAIL.PUBLISH_ITEM_TITLE,
            translationVariables: { itemName: item.name },
          },
          lang: member.lang,
        })
          .addText(MAIL.PUBLISH_ITEM_TEXT, { itemName: item.name })
          .addButton(MAIL.PUBLISH_ITEM_BUTTON_TEXT, link, {
            itemName: item.name,
          })
          .build();

        await this.mailerService.send(mail, member.email).catch((err) => {
          this.log.warn(err, `mailerService failed. published link: ${link}`);
        });
      }
    }
  }

  async get(actor: Actor, repositories: Repositories, itemId: string) {
    const { itemPublishedRepository, itemVisibilityRepository, actionRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId);

    // item should be public first
    await itemVisibilityRepository.getType(item.path, ItemVisibilityType.Public, {
      shouldThrow: true,
    });

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
    return {
      totalViews: (totalViews?.[0] as ActionCount)?.actionCount,
      ...publishedItem,
    };
  }

  async getMany(actor: Actor, repositories: Repositories, itemIds: string[]) {
    const { itemPublishedRepository, itemVisibilityRepository } = repositories;
    const { data: itemsMap, errors } = await this.itemService.getMany(actor, repositories, itemIds);

    const items = Object.values(itemsMap);

    // item should be public first
    const { data: areItemsPublic, errors: publicErrors } =
      await itemVisibilityRepository.hasForMany(items, ItemVisibilityType.Public);

    const { data: publishedInfo, errors: publishedErrors } =
      await itemPublishedRepository.getForItems(items.filter((i) => areItemsPublic[i.id]));

    return {
      data: publishedInfo,
      errors: [...errors, ...publicErrors, ...publishedErrors],
    };
  }

  async publishIfNotExist(
    member: Member,
    repositories: Repositories,
    itemId: string,
    publicationStatus: PublicationStatus,
  ) {
    const { itemPublishedRepository } = repositories;

    const item = await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    const itemPublished = await itemPublishedRepository.getForItem(item);

    if (itemPublished) {
      return itemPublished;
    }

    return await this.post(member, repositories, item, publicationStatus, {
      canBePrivate: true,
    });
  }

  private checkPublicationStatus({ id, type }: Item, publicationStatus: PublicationStatus) {
    switch (publicationStatus) {
      case PublicationStatus.ReadyToPublish:
        return true;
      case PublicationStatus.ItemTypeNotAllowed:
        throw new ItemTypeNotAllowedToPublish(id, type);
      case PublicationStatus.Published:
      case PublicationStatus.PublishedChildren:
        throw new ItemPublicationAlreadyExists(id);
      case PublicationStatus.Unpublished:
      case PublicationStatus.Pending:
      case PublicationStatus.Invalid:
      case PublicationStatus.Outdated:
      default:
        throw new ItemIsNotValidated(id);
    }
  }

  async post(
    member: Member,
    repositories: Repositories,
    item: Item,
    publicationStatus: PublicationStatus,
    { canBePrivate }: { canBePrivate?: boolean } = {},
  ) {
    const { itemPublishedRepository, itemVisibilityRepository } = repositories;

    // ensure that the item can be published
    this.checkPublicationStatus(item, publicationStatus);

    // item should be public first
    const visibility = await itemVisibilityRepository.getType(
      item.path,
      ItemVisibilityType.Public,
      {
        shouldThrow: !canBePrivate,
      },
    );

    // if the item can be private and be published, set it to public automatically.
    // it's usefull to publish the item automatically after the validation.
    // the user is asked to set the item to public in the frontend.
    if (!visibility && canBePrivate) {
      await itemVisibilityRepository.post(member, item, ItemVisibilityType.Public);
    }

    // TODO: check validation is alright

    const published = await itemPublishedRepository.post(member, item);

    await this.meilisearchWrapper.indexOne(published, repositories);

    //TODO: should we sent a publish hooks for all descendants? If yes take inspiration from delete method in ItemService

    this._notifyContributors(member, repositories, item);

    return published;
  }

  async delete(member: Member, repositories: Repositories, itemId: string) {
    const { itemPublishedRepository } = repositories;

    const item = await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    await this.hooks.runPreHooks('delete', member, repositories, { item });

    const result = await itemPublishedRepository.deleteForItem(item);

    await this.hooks.runPostHooks('delete', member, repositories, { item });

    return result;
  }

  async touchUpdatedAt(repositories: Repositories, item: { id: Item['id']; path: Item['path'] }) {
    const { itemPublishedRepository } = repositories;

    const updatedAt = await itemPublishedRepository.touchUpdatedAt(item.path);

    // change value in meilisearch index
    await this.meilisearchWrapper.updateItem(item.id, { updatedAt });
  }

  async getItemsForMember(actor: Actor, repositories, memberId: UUID) {
    const { itemRepository } = repositories;
    const items = await itemRepository.getPublishedItemsForMember(memberId);

    return ItemWrapper.createPackedItems(actor, repositories, this.itemThumbnailService, items);
  }

  async getRecentItems(actor: Actor, repositories: Repositories, limit?: number) {
    const { itemPublishedRepository } = repositories;
    const items = await itemPublishedRepository.getRecentItems(limit);

    return filterOutHiddenItems(repositories, items);
  }
}
