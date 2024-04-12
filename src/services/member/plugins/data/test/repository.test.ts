import build, { clearDatabase } from '../../../../../../test/app';
import { AppDataSource } from '../../../../../plugins/datasource';
import { Action } from '../../../../action/entities/action';
import { ActionRepository } from '../../../../action/repositories/action';
import { saveActions } from '../../../../action/test/fixtures/actions';
import { ChatMessage } from '../../../../chat/chatMessage';
import { ChatMention } from '../../../../chat/plugins/mentions/chatMention';
import { ChatMentionRepository } from '../../../../chat/plugins/mentions/repository';
import { ChatMessageRepository } from '../../../../chat/repository';
import { AppActionRepository } from '../../../../item/plugins/app/appAction/repository';
import { saveAppActions } from '../../../../item/plugins/app/appAction/test/fixtures';
import { AppDataRepository } from '../../../../item/plugins/app/appData/repository';
import { saveAppData } from '../../../../item/plugins/app/appData/test/fixtures';
import { AppSettingRepository } from '../../../../item/plugins/app/appSetting/repository';
import { saveAppSettings } from '../../../../item/plugins/app/appSetting/test/fixtures';
import { ItemCategoryRepository } from '../../../../item/plugins/itemCategory/repositories/itemCategory';
import {
  saveCategories,
  saveItemCategories,
} from '../../../../item/plugins/itemCategory/test/fixtures';
import { FavoriteRepository } from '../../../../item/plugins/itemFavorite/repositories/favorite';
import { ItemLikeRepository } from '../../../../item/plugins/itemLike/repository';
import { saveItemLikes } from '../../../../item/plugins/itemLike/test/utils';
import { ItemRepository } from '../../../../item/repository';
import { ItemTestUtils } from '../../../../item/test/fixtures/items';
import { saveMember } from '../../../test/fixtures/members';
import { expectObjects, saveChatMessages, saveItemFavorites } from './fixtures';

/**
 * The repository tests ensure that no unwanted columns are leaked during the export.
 */

const itemTestUtils = new ItemTestUtils();

jest.mock('../../../../../plugins/datasource');

describe('DataMember Export', () => {
  let app;
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

      const result = await new ActionRepository().getForMemberExport(exportingActor.id);

      expectObjects({
        results: result,
        expectations: [...actions, ...otherActions],
        wantedProps: [
          'id',
          'view',
          'type',
          'extra',
          'geolocation',
          'createdAt',
          'memberId',
          'itemId',
        ],
        // unwantedProps: ['member', 'item'],
        typeName: 'Action',
      });
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

      const result = await AppActionRepository.getForMemberExport(exportingActor.id);

      expectObjects({
        results: result,
        expectations: [...appActions, ...otherActions],
        wantedProps: ['id', 'memberId', 'itemId', 'data', 'type', 'createdAt'],
        // unwantedProps: ['member', 'item'],
        typeName: 'AppAction',
      });
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

      const result = await AppDataRepository.getForMemberExport(exportingActor.id);

      expectObjects({
        results: result,
        expectations: [...appData, ...appDataWithActorAsMember, ...appDataWithOtherMember],
        wantedProps: [
          'id',
          'memberId',
          'itemId',
          'data',
          'type',
          'visibility',
          'creatorId',
          'createdAt',
          'updatedAt',
        ],
        // unwantedProps: ['member', 'item', 'creator'],
        typeName: 'AppData',
      });
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

      const result = await AppSettingRepository.getForMemberExport(exportingActor.id);

      expectObjects({
        results: result,
        expectations: appSettings,
        wantedProps: ['id', 'itemId', 'data', 'name', 'creatorId', 'createdAt', 'updatedAt'],
        // unwantedProps: ['item', 'creator'],
        typeName: 'AppSetting',
      });
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
        const result = await new ChatMentionRepository().getForMemberExport(exportingActor.id);

        expectObjects({
          results: result,
          expectations: chatMentions,
          wantedProps: ['id', 'messageId', 'memberId', 'createdAt', 'updatedAt', 'status'],
          // unwantedProps: ['message', 'member'],
          typeName: 'ChatMention',
        });
      });
    });

    describe('ChatMessages', () => {
      it('get all Messages for the member', async () => {
        const result = await ChatMessageRepository.getForMemberExport(exportingActor.id);

        expectObjects({
          results: result,
          expectations: chatMessages,
          wantedProps: ['id', 'itemId', 'creatorId', 'createdAt', 'updatedAt', 'body'],
          // unwantedProps: ['item', 'creator'],
          typeName: 'ChatMessage',
        });
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

      const result = await new ItemRepository().getForMemberExport(exportingActor.id);

      expectObjects({
        results: result,
        expectations: items,
        wantedProps: [
          'id',
          'name',
          'type',
          'description',
          'path',
          'creatorId',
          'extra',
          'settings',
          'createdAt',
          'updatedAt',
          'deletedAt',
          'lang',
          'search_document',
          'displayName',
        ],
        // unwantedProps: ['creator'],
        typeName: 'Item',
      });
    });

    it('get all Item Categories for the member', async () => {
      const categories = await saveCategories();
      // When using .save on ICategoryRepository, itemPath seems to be the itemId.
      // It is an fix just to compare with the getForMemberExport method who get itemPath correctly.
      const itemCategories = (
        await saveItemCategories({
          item,
          categories,
          creator: exportingActor,
        })
      ).map((iC) => ({ ...iC, itemPath: iC.item.path }));

      // noise
      await saveItemCategories({ item: itemOfRandomUser, categories, creator: randomUser });

      const result = await ItemCategoryRepository.getForMemberExport(exportingActor.id);

      expectObjects({
        results: result,
        expectations: itemCategories,
        wantedProps: ['id', 'creatorId', 'itemPath', 'category', 'createdAt'],
        // unwantedProps: ['creator', 'item'],
        typeName: 'ItemCategory',
      });
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

      const result = await new FavoriteRepository().getForMemberExport(exportingActor.id);

      expectObjects({
        results: result,
        expectations: favorites,
        wantedProps: ['id', 'memberId', 'itemId', 'createdAt'],
        // unwantedProps: ['creator', 'item'],
        typeName: 'ItemFavorite',
      });
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

      const result = await ItemLikeRepository.getForMemberExport(exportingActor.id);

      expectObjects({
        results: result,
        expectations: likes,
        wantedProps: ['id', 'creatorId', 'itemId', 'createdAt'],
        // unwantedProps: ['creator', 'item'],
        typeName: 'ItemLike',
      });
    });
  });
});
