import { singleton } from 'tsyringe';

import {
  ClientManager,
  Context,
  ItemVisibilityType,
  PermissionLevel,
  PublicationStatus,
  UUID,
} from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { Item, ItemPublishedRaw } from '../../../../../drizzle/types';
import { TRANSLATIONS } from '../../../../../langs/constants';
import { BaseLogger } from '../../../../../logger';
import { MailBuilder } from '../../../../../plugins/mailer/builder';
import { MailerService } from '../../../../../plugins/mailer/mailer.service';
import { MaybeUser, MinimalMember } from '../../../../../types';
import HookManager from '../../../../../utils/hook';
import { isMember } from '../../../../authentication';
import { filterOutHiddenItems } from '../../../../authorization.utils';
import { ItemMembershipRepository } from '../../../../itemMembership/membership.repository';
import { MemberRepository } from '../../../../member/member.repository';
import { ItemWrapperService } from '../../../ItemWrapper';
import { BasicItemService } from '../../../basic.service';
import { ItemRepository } from '../../../item.repository';
import { ItemActionService } from '../../action/itemAction.service';
import { ItemVisibilityRepository } from '../../itemVisibility/itemVisibility.repository';
import {
  ItemIsNotValidated,
  ItemPublicationAlreadyExists,
  ItemTypeNotAllowedToPublish,
} from './errors';
import { ItemPublishedRepository } from './itemPublished.repository';
import { MeiliSearchWrapper } from './plugins/search/meilisearch';

@singleton()
export class ItemPublishedService {
  private readonly log: BaseLogger;
  private readonly basicItemService: BasicItemService;
  private readonly meilisearchWrapper: MeiliSearchWrapper;
  private readonly mailerService: MailerService;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;
  private readonly itemWrapperService: ItemWrapperService;
  private readonly itemPublishedRepository: ItemPublishedRepository;
  private readonly itemRepository: ItemRepository;
  private readonly memberRepository: MemberRepository;
  private readonly itemActionService: ItemActionService;

  hooks = new HookManager<{
    create: {
      pre: { item: Item };
      post: { published: ItemPublishedRaw; item: Item };
    };
    delete: { pre: { item: Item }; post: { item: Item } };
  }>();

  constructor(
    basicItemService: BasicItemService,
    mailerService: MailerService,
    meilisearchWrapper: MeiliSearchWrapper,
    itemVisibilityRepository: ItemVisibilityRepository,
    itemMembershipRepository: ItemMembershipRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemWrapperService: ItemWrapperService,
    itemRepository: ItemRepository,
    memberRepository: MemberRepository,
    itemActionService: ItemActionService,
    log: BaseLogger,
  ) {
    this.log = log;
    this.basicItemService = basicItemService;
    this.meilisearchWrapper = meilisearchWrapper;
    this.itemVisibilityRepository = itemVisibilityRepository;
    this.itemPublishedRepository = itemPublishedRepository;
    this.itemMembershipRepository = itemMembershipRepository;
    this.itemRepository = itemRepository;
    this.memberRepository = memberRepository;
    this.itemWrapperService = itemWrapperService;
    this.mailerService = mailerService;
    this.itemActionService = itemActionService;
  }

  async _notifyContributors(
    dbConnection: DBConnection,
    actor: MinimalMember,
    item: Item,
  ): Promise<void> {
    // send email to contributors except yourself
    const memberships = await this.itemMembershipRepository.getForItem(dbConnection, item);
    const contributors = memberships
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

  async get(dbConnection: DBConnection, actor: MaybeUser, itemId: string) {
    const item = await this.basicItemService.get(dbConnection, actor, itemId);

    // item should be public first
    await this.itemVisibilityRepository.getType(
      dbConnection,
      item.path,
      ItemVisibilityType.Public,
      {
        shouldThrow: true,
      },
    );

    // get item published entry
    const publishedItem = await this.itemPublishedRepository.getForItem(dbConnection, item.path);

    if (!publishedItem) {
      return null;
    }
    // get views from the actions table
    const totalViews = await this.itemActionService.getTotalViewsCountForItemId(
      dbConnection,
      item.id,
    );
    return {
      totalViews,
      creator: publishedItem.item.creator,
      ...publishedItem,
    };
  }

  async publishIfNotExist(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: string,
    publicationStatus: PublicationStatus,
  ) {
    const item = await this.basicItemService.get(
      dbConnection,
      member,
      itemId,
      PermissionLevel.Admin,
    );

    const itemPublished = await this.itemPublishedRepository.getForItem(dbConnection, item.path);

    if (itemPublished) {
      return itemPublished;
    }

    await this.post(dbConnection, member, item, publicationStatus, {
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
    dbConnection: DBConnection,
    member: MinimalMember,
    item: Item,
    publicationStatus: PublicationStatus,
    { canBePrivate }: { canBePrivate?: boolean } = {},
  ) {
    // ensure that the item can be published
    this.checkPublicationStatus(item, publicationStatus);

    // item should be public first
    const visibility = await this.itemVisibilityRepository.getType(
      dbConnection,
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
      await this.itemVisibilityRepository.post(
        dbConnection,
        member.id,
        item.path,
        ItemVisibilityType.Public,
      );
    }

    // TODO: check validation is alright

    await this.itemPublishedRepository.post(dbConnection, member, item);
    const published = await this.itemPublishedRepository.getForItem(dbConnection, item.path);
    if (published) {
      await this.meilisearchWrapper.indexOne(dbConnection, published);
    }

    //TODO: should we sent a publish hooks for all descendants? If yes take inspiration from delete method in ItemService
    this._notifyContributors(dbConnection, member, item);

    return published;
  }

  async delete(dbConnection: DBConnection, member: MinimalMember, itemId: string) {
    const item = await this.basicItemService.get(
      dbConnection,
      member,
      itemId,
      PermissionLevel.Admin,
    );

    await this.hooks.runPreHooks('delete', member, dbConnection, { item });

    const result = await this.itemPublishedRepository.deleteForItem(dbConnection, item);

    await this.hooks.runPostHooks('delete', member, dbConnection, { item });

    return result;
  }

  async touchUpdatedAt(dbConnection: DBConnection, item: { id: Item['id']; path: Item['path'] }) {
    const updatedAt = await this.itemPublishedRepository.touchUpdatedAt(dbConnection, item.path);

    if (updatedAt) {
      // change value in meilisearch index
      await this.meilisearchWrapper.updateItem(item.id, { updatedAt });
    }
  }

  async getItemsForMember(dbConnection: DBConnection, actor: MaybeUser, memberId: UUID) {
    const items = await this.itemRepository.getPublishedItemsForMember(dbConnection, memberId);

    return this.itemWrapperService.createPackedItems(dbConnection, items);
  }

  async getRecentItems(dbConnection: DBConnection, actor: MaybeUser, limit?: number) {
    const items = await this.itemPublishedRepository.getRecentItems(dbConnection, limit);

    return filterOutHiddenItems(
      dbConnection,
      { itemVisibilityRepository: this.itemVisibilityRepository },
      items,
    );
  }
}
