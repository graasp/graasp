import { FastifyInstance } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app.js';
import { AppDataSource } from '../../../../../plugins/datasource.js';
import { Action } from '../../../../action/entities/action.js';
import { ActionRepository } from '../../../../action/repositories/action.js';
import { saveActions } from '../../../../action/test/fixtures/actions.js';
import { ChatMessage } from '../../../../chat/chatMessage.js';
import { ChatMention } from '../../../../chat/plugins/mentions/chatMention.js';
import { ChatMentionRepository } from '../../../../chat/plugins/mentions/repository.js';
import { ChatMessageRepository } from '../../../../chat/repository.js';
import { saveChatMessages } from '../../../../chat/test/fixtures.js';
import { AppActionRepository } from '../../../../item/plugins/app/appAction/repository.js';
import { saveAppActions } from '../../../../item/plugins/app/appAction/test/fixtures.js';
import { AppDataRepository } from '../../../../item/plugins/app/appData/repository.js';
import { saveAppData } from '../../../../item/plugins/app/appData/test/fixtures.js';
import { AppSettingRepository } from '../../../../item/plugins/app/appSetting/repository.js';
import { saveAppSettings } from '../../../../item/plugins/app/appSetting/test/fixtures.js';
import { ItemCategoryRepository } from '../../../../item/plugins/itemCategory/repositories/itemCategory.js';
import {
  saveCategories,
  saveItemCategories,
} from '../../../../item/plugins/itemCategory/test/fixtures.js';
import { FavoriteRepository } from '../../../../item/plugins/itemFavorite/repositories/favorite.js';
import { saveItemFavorites } from '../../../../item/plugins/itemFavorite/test/fixtures.js';
import { ItemLikeRepository } from '../../../../item/plugins/itemLike/repository.js';
import { saveItemLikes } from '../../../../item/plugins/itemLike/test/utils.js';
import { ItemRepository } from '../../../../item/repository.js';
import { ItemTestUtils } from '../../../../item/test/fixtures/items.js';
import { ItemMembership } from '../../../../itemMembership/entities/ItemMembership.js';
import { ItemMembershipRepository } from '../../../../itemMembership/repository.js';
import { saveMember } from '../../../test/fixtures/members.js';
import {
  actionSchema,
  appActionSchema,
  appDataSchema,
  appSettingSchema,
  itemCategorySchema,
  itemFavoriteSchema,
  itemLikeSchema,
  itemMembershipSchema,
  itemSchema,
  messageMentionSchema,
  messageSchema,
} from '../schemas/schemas.js';
import { expectNoLeaksAndEquality } from './fixtures.js';

/**
 * The repository tests ensure that no unwanted columns are leaked during the export.
 */

const itemTestUtils = new ItemTestUtils();

jest.mock('../../../../../plugins/datasource');

describe('DataMember Export', () => {
  let app: FastifyInstance;
  let exportingActor;
  let randomUser;
  let item;
  let itemOfRandomUser;

  beforeEach(async () => {
    ({ app, actor: exportingActor } = await build());
    randomUser = await saveMember();

    item = await itemTestUtils.saveItem({ actor: exportingActor });
    itemOfRandomUser = await itemTestUtils.saveItem({ actor: randomUser });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    exportingActor = null;
    randomUser = null;
    item = null;
    app.close();
  });

  describe('Actions', () => {
    const rawActionRepository = AppDataSource.getRepository(Action);

    it('get all Actions for the member', async () => {
      // save for exporting actor
      const actions = await saveActions(rawActionRepository, [
        { item, member: exportingActor },
        { item, member: exportingActor },
        { item, member: exportingActor },
      ]);
      // on item of random user
      const otherActions = await saveActions(rawActionRepository, [
        { item: itemOfRandomUser, member: exportingActor },
        { item: itemOfRandomUser, member: exportingActor },
        { item: itemOfRandomUser, member: exportingActor },
      ]);

      // noise: save for a random user
      await saveActions(rawActionRepository, [{ item, member: randomUser }]);
      await saveActions(rawActionRepository, [{ item: itemOfRandomUser, member: randomUser }]);

      const results = await new ActionRepository().getForMemberExport(exportingActor.id);
      expectNoLeaksAndEquality(results, [...actions, ...otherActions], actionSchema);
    });
  });

  describe('AppActions', () => {
    it('get all AppActions for the member', async () => {
      // save for exporting actor
      const appActions = await saveAppActions({ item, member: exportingActor });
      // on item of random user
      const otherActions = await saveAppActions({ item: itemOfRandomUser, member: exportingActor });

      // noise: for a random member
      await saveAppActions({ item, member: randomUser });
      await saveAppActions({ item: itemOfRandomUser, member: randomUser });

      const results = await AppActionRepository.getForMemberExport(exportingActor.id);
      expectNoLeaksAndEquality(results, [...appActions, ...otherActions], appActionSchema);
    });
  });

  describe('AppData', () => {
    it('get all AppData for the member', async () => {
      const appData = await saveAppData({ item, creator: exportingActor });
      const appDataWithActorAsMember = await saveAppData({
        item: itemOfRandomUser,
        creator: randomUser,
        member: exportingActor,
      });
      const appDataWithOtherMember = await saveAppData({
        item,
        creator: exportingActor,
        member: randomUser,
      });

      // noise: for a random member
      await saveAppData({ item: itemOfRandomUser, creator: randomUser });

      const results = await AppDataRepository.getForMemberExport(exportingActor.id);
      expectNoLeaksAndEquality(
        results,
        [...appData, ...appDataWithActorAsMember, ...appDataWithOtherMember],
        appDataSchema,
      );
    });
  });

  describe('AppSettings', () => {
    it('get all AppSettings for the member', async () => {
      const appSettings = await saveAppSettings({ item, creator: exportingActor });
      // noise: for a random member
      await saveAppSettings({
        item: itemOfRandomUser,
        creator: randomUser,
      });

      const results = await AppSettingRepository.getForMemberExport(exportingActor.id);
      expectNoLeaksAndEquality(results, appSettings, appSettingSchema);
    });
  });

  describe('Chat', () => {
    let chatMessages: ChatMessage[];
    let chatMentions: ChatMention[];

    beforeEach(async () => {
      // exporting member mentions another user, so this mention data is for the random user only.
      ({ chatMessages } = await saveChatMessages({
        item,
        creator: exportingActor,
        mentionMember: randomUser,
      }));

      ({ chatMentions } = await saveChatMessages({
        item: itemOfRandomUser,
        creator: randomUser,
        mentionMember: exportingActor,
      }));
    });

    describe('ChatMentions', () => {
      it('get all ChatMentions for the member', async () => {
        const results = await new ChatMentionRepository().getForMemberExport(exportingActor.id);
        expectNoLeaksAndEquality(results, chatMentions, messageMentionSchema);
      });
    });

    describe('ChatMessages', () => {
      it('get all Messages for the member', async () => {
        const results = await ChatMessageRepository.getForMemberExport(exportingActor.id);
        expectNoLeaksAndEquality(results, chatMessages, messageSchema);
      });
    });
  });

  describe('Items', () => {
    it('get all Items for the member', async () => {
      const items = [
        item,
        await itemTestUtils.saveItem({ actor: exportingActor }),
        await itemTestUtils.saveItem({ actor: exportingActor }),
        await itemTestUtils.saveItem({ actor: exportingActor }),
      ];

      // noise
      await itemTestUtils.saveItem({ actor: randomUser });
      await itemTestUtils.saveItem({ actor: randomUser });
      await itemTestUtils.saveItem({ actor: randomUser });

      const results = await new ItemRepository().getForMemberExport(exportingActor.id);
      expectNoLeaksAndEquality(results, items, itemSchema);
    });

    it('get all Item Categories for the member', async () => {
      const categories = await saveCategories();
      const itemCategories = await saveItemCategories({
        item,
        categories,
        creator: exportingActor,
      });

      // noise
      await saveItemCategories({ item: itemOfRandomUser, categories, creator: randomUser });

      const results = await ItemCategoryRepository.getForMemberExport(exportingActor.id);
      expectNoLeaksAndEquality(results, itemCategories, itemCategorySchema);
    });

    it('get all Item Favorites for the member', async () => {
      const items = [
        await itemTestUtils.saveItem({ actor: exportingActor }),
        await itemTestUtils.saveItem({ actor: exportingActor }),
        await itemTestUtils.saveItem({ actor: exportingActor }),
      ];
      const favorites = await saveItemFavorites({
        items,
        member: exportingActor,
      });

      // noise
      await saveItemFavorites({ items: [itemOfRandomUser], member: randomUser });

      const results = await new FavoriteRepository().getForMemberExport(exportingActor.id);
      expectNoLeaksAndEquality(results, favorites, itemFavoriteSchema);
    });

    it('get all Item Likes for the member', async () => {
      // TODO: maybe insert beforeEach...
      const items = [
        await itemTestUtils.saveItem({ actor: exportingActor }),
        await itemTestUtils.saveItem({ actor: exportingActor }),
        await itemTestUtils.saveItem({ actor: exportingActor }),
      ];
      const likes = await saveItemLikes(items, exportingActor);

      // noise
      await saveItemLikes([itemOfRandomUser], randomUser);
      await saveItemLikes(items, randomUser);

      const results = await ItemLikeRepository.getForMemberExport(exportingActor.id);
      expectNoLeaksAndEquality(results, likes, itemLikeSchema);
    });

    it('get all Item Memberships for the member', async () => {
      // TODO: maybe insert beforeEach...
      const actorItems = [
        await itemTestUtils.saveItem({ actor: exportingActor }),
        await itemTestUtils.saveItem({ actor: exportingActor }),
        await itemTestUtils.saveItem({ actor: exportingActor }),
      ];
      const randomItems = [
        await itemTestUtils.saveItem({ actor: randomUser }),
        await itemTestUtils.saveItem({ actor: randomUser }),
      ];

      const memberships: ItemMembership[] = [];

      for (const item of actorItems) {
        const membership = await itemTestUtils.saveMembership({
          item,
          member: exportingActor,
          permission: PermissionLevel.Admin,
        });
        memberships.push(membership);
      }

      for (const item of randomItems) {
        const membership = await itemTestUtils.saveMembership({
          item,
          member: exportingActor,
          permission: PermissionLevel.Read,
        });
        memberships.push(membership);
      }

      // noise
      await itemTestUtils.saveItemAndMembership({ creator: exportingActor, member: randomUser });
      await itemTestUtils.saveItemAndMembership({ creator: exportingActor, member: randomUser });
      await itemTestUtils.saveItemAndMembership({
        creator: exportingActor,
        member: randomUser,
        permission: PermissionLevel.Read,
      });

      const results = await ItemMembershipRepository.getForMemberExport(exportingActor.id);
      expectNoLeaksAndEquality(results, memberships, itemMembershipSchema);
    });
  });
});
