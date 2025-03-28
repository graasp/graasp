import { injectable, singleton } from 'tsyringe';

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
import { ActionItemService } from '../../action/itemAction.service';
import { ItemVisibilityRepository } from '../../itemVisibility/repository';
import {
  ItemIsNotValidated,
  ItemPublicationAlreadyExists,
  ItemTypeNotAllowedToPublish,
} from './errors';
import { ItemPublishedRepository } from './itemPublished.repository';
import { MeiliSearchWrapper } from './plugins/search/meilisearch';

interface ActionCount {
  actionCount: number;
}

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
  private readonly actionItemService: ActionItemService;

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
    actionItemService: ActionItemService,
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
    this.actionItemService = actionItemService;
  }

  async _notifyContributors(db: DBConnection, actor: MinimalMember, item: Item): Promise<void> {
    // send email to contributors except yourself
    const memberships = await this.itemMembershipRepository.getForItem(db, item);
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

        // TODO: does not seem efficient
        const memberWithEmail = await this.memberRepository.get(db, member.id);

        await this.mailerService.send(mail, memberWithEmail.email).catch((err) => {
          this.log.warn(err, `mailerService failed. published link: ${link}`);
        });
      }
    }
  }

  async get(db: DBConnection, actor: MaybeUser, itemId: string) {
    const item = await this.basicItemService.get(db, actor, itemId);

    // item should be public first
    await this.itemVisibilityRepository.getType(db, item.path, ItemVisibilityType.Public, {
      shouldThrow: true,
    });

    // get item published entry
    const publishedItem = await this.itemPublishedRepository.getForItem(db, item.path);

    if (!publishedItem) {
      return null;
    }
    // get views from the actions table
    const totalViews = await this.actionItemService.getTotalViewsCountForItemId(db, item.id);
    return {
      totalViews,
      creator: publishedItem.item.creator,
      ...publishedItem,
    };
  }

  async publishIfNotExist(
    db: DBConnection,
    member: MinimalMember,
    itemId: string,
    publicationStatus: PublicationStatus,
  ) {
    const item = await this.basicItemService.get(db, member, itemId, PermissionLevel.Admin);

    const itemPublished = await this.itemPublishedRepository.getForItem(db, item.path);

    if (itemPublished) {
      return itemPublished;
    }

    await this.post(db, member, item, publicationStatus, {
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
    member: MinimalMember,
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
      await this.itemVisibilityRepository.post(db, member.id, item.path, ItemVisibilityType.Public);
    }

    // TODO: check validation is alright

    await this.itemPublishedRepository.post(db, member, item);
    const published = await this.itemPublishedRepository.getForItem(db, item.path);
    if (published) {
      await this.meilisearchWrapper.indexOne(db, published);
    }

    //TODO: should we sent a publish hooks for all descendants? If yes take inspiration from delete method in ItemService
    this._notifyContributors(db, member, item);

    return published;
  }

  async delete(db: DBConnection, member: MinimalMember, itemId: string) {
    const item = await this.basicItemService.get(db, member, itemId, PermissionLevel.Admin);

    await this.hooks.runPreHooks('delete', member, db, { item });

    const result = await this.itemPublishedRepository.deleteForItem(db, item);

    await this.hooks.runPostHooks('delete', member, db, { item });

    return result;
  }

  async touchUpdatedAt(db: DBConnection, item: { id: Item['id']; path: Item['path'] }) {
    const updatedAt = await this.itemPublishedRepository.touchUpdatedAt(db, item.path);

    // change value in meilisearch index
    await this.meilisearchWrapper.updateItem(item.id, { updatedAt });
  }

  async getItemsForMember(db: DBConnection, actor: MaybeUser, memberId: UUID) {
    const items = await this.itemRepository.getPublishedItemsForMember(db, memberId);

    return this.itemWrapperService.createPackedItems(db, items);
  }

  async getRecentItems(db: DBConnection, actor: MaybeUser, limit?: number) {
    const items = await this.itemPublishedRepository.getRecentItems(db, limit);

    return filterOutHiddenItems(
      db,
      { itemVisibilityRepository: this.itemVisibilityRepository },
      items,
    );
  }
}
