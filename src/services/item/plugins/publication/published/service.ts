import { formatISO } from 'date-fns';
import { singleton } from 'tsyringe';

import {
  ClientManager,
  Context,
  ItemVisibilityType,
  PermissionLevel,
  PublicationStatus,
  UUID,
} from '@graasp/sdk';

import { TRANSLATIONS } from '../../../../../langs/constants';
import { BaseLogger } from '../../../../../logger';
import { MailBuilder } from '../../../../../plugins/mailer/builder';
import { MailerService } from '../../../../../plugins/mailer/mailer.service';
import { resultOfToList } from '../../../../../services/utils';
import HookManager from '../../../../../utils/hook';
import { filterOutHiddenItems } from '../../../../authorization';
import { Actor, Member, isMember } from '../../../../member/entities/member';
import { ItemWrapper } from '../../../ItemWrapper';
import { Item } from '../../../entities/Item';
import { ItemService } from '../../../service';
import { ItemThumbnailService } from '../../thumbnail/service';
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
    create: {
      pre: { item: Item };
      post: { published: ItemPublished; item: Item };
    };
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

  async _notifyContributors(db: DBConnection, actor: Member, item: Item): Promise<void> {
    // send email to contributors except yourself
    const memberships = await this.itemMembershipRepository.getForManyItems(db, [item]);
    const contributors = resultOfToList(memberships)[0]
      .filter(
        ({ permission, account }) =>
          permission === PermissionLevel.Admin && account.id !== actor.id,
      )
      .map(({ account }) => account);

    const link = ClientManager.getInstance().getItemLink(Context.Library, item.id);

    for (const member of contributors) {
      if (isMember(member)) {
        const mail = new MailBuilder({
          subject: {
            text: TRANSLATIONS.PUBLISH_ITEM_TITLE,
            translationVariables: { itemName: item.name },
          },
          lang: member.lang,
        })
          .addText(TRANSLATIONS.PUBLISH_ITEM_TEXT, { itemName: item.name })
          .addButton(TRANSLATIONS.PUBLISH_ITEM_BUTTON_TEXT, link, {
            itemName: item.name,
          })
          .build();

        await this.mailerService.send(mail, member.email).catch((err) => {
          this.log.warn(err, `mailerService failed. published link: ${link}`);
        });
      }
    }
  }

  async get(db: DBConnection, actor: Actor, itemId: string) {
    const item = await this.itemService.get(db, actor, itemId);

    // item should be public first
    await this.itemVisibilityRepository.getType(item.path, ItemVisibilityType.Public, {
      shouldThrow: true,
    });

    // get item published entry
    const publishedItem = await this.itemPublishedRepository.getForItem(item);

    if (!publishedItem) {
      return null;
    }
    // get views from the actions table
    const totalViews = await this.actionRepository.getAggregationForItem(item.path, {
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

  async getMany(db: DBConnection, actor: Actor, itemIds: string[]) {
    const { data: itemsMap, errors } = await this.itemService.getMany(db, actor, itemIds);

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
    db: DBConnection,
    member: Member,
    itemId: string,
    publicationStatus: PublicationStatus,
  ) {
    const item = await this.itemService.get(db, member, itemId, PermissionLevel.Admin);

    const itemPublished = await this.itemPublishedRepository.getForItem(item);

    if (itemPublished) {
      return itemPublished;
    }

    return await this.post(db, member, item, publicationStatus, {
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
    db: DBConnection,
    member: Member,
    item: Item,
    publicationStatus: PublicationStatus,
    { canBePrivate }: { canBePrivate?: boolean } = {},
  ) {
    // ensure that the item can be published
    this.checkPublicationStatus(item, publicationStatus);

    // item should be public first
    const visibility = await this.itemVisibilityRepository.getType(
      db,
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
      await this.itemVisibilityRepository.post(db, member, item, ItemVisibilityType.Public);
    }

    // TODO: check validation is alright

    const published = await this.itemPublishedRepository.post(db, member, item);

    await this.meilisearchWrapper.indexOne(db, published);

    //TODO: should we sent a publish hooks for all descendants? If yes take inspiration from delete method in ItemService

    this._notifyContributors(db, member, item);

    return published;
  }

  async delete(db: DBConnection, member: Member, itemId: string) {
    const item = await this.itemService.get(db, member, itemId, PermissionLevel.Admin);

    await this.hooks.runPreHooks('delete', member, db, { item });

    const result = await itemPublishedRepository.deleteForItem(item);

    await this.hooks.runPostHooks('delete', member, db, { item });

    return result;
  }

  async touchUpdatedAt(db: DBConnection, item: { id: Item['id']; path: Item['path'] }) {
    const updatedAt = await this.itemPublishedRepository.touchUpdatedAt(item.path);

    // change value in meilisearch index
    await this.meilisearchWrapper.updateItem(item.id, { updatedAt });
  }

  async getItemsForMember(db: DBConnection, actor: Actor, memberId: UUID) {
    const items = await this.itemRepository.getPublishedItemsForMember(memberId);

    return ItemWrapper.createPackedItems(actor, db, this.itemThumbnailService, items);
  }

  async getRecentItems(db: DBConnection, actor: Actor, limit?: number) {
    const items = await this.itemPublishedRepository.getRecentItems(db, limit);

    return filterOutHiddenItems(db, items);
  }
}
