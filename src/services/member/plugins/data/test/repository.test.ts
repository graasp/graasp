import build, { clearDatabase } from '../../../../../../test/app';
import { AppDataSource } from '../../../../../plugins/datasource';
import { Action } from '../../../../action/entities/action';
import { ActionRepository } from '../../../../action/repositories/action';
import { saveActions } from '../../../../action/test/fixtures/actions';
import { ChatMessage } from '../../../../chat/chatMessage';
import { ChatMention } from '../../../../chat/plugins/mentions/chatMention';
import { ChatMentionRepository } from '../../../../chat/plugins/mentions/repository';
import { ChatMessageRepository } from '../../../../chat/repository';
import { AppAction } from '../../../../item/plugins/app/appAction/appAction';
import { AppActionRepository } from '../../../../item/plugins/app/appAction/repository';
import { saveAppActions } from '../../../../item/plugins/app/appAction/test/fixtures';
import { AppData } from '../../../../item/plugins/app/appData/appData';
import { AppDataRepository } from '../../../../item/plugins/app/appData/repository';
import { saveAppData } from '../../../../item/plugins/app/appData/test/fixtures';
import { AppSetting } from '../../../../item/plugins/app/appSetting/appSettings';
import { AppSettingRepository } from '../../../../item/plugins/app/appSetting/repository';
import { saveAppSettings } from '../../../../item/plugins/app/appSetting/test/fixtures';
import { ItemTestUtils } from '../../../../item/test/fixtures/items';
import { saveMember } from '../../../test/fixtures/members';
import { expectObjects, saveChatMessages } from './fixtures';

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
    let actions: Action[], otherActions: Action[];

    beforeEach(async () => {
      // save for exporting actor
      actions = await saveActions(rawActionRepository, [
        { item, member: exportingActor },
        { item, member: exportingActor },
        { item, member: exportingActor },
      ]);
      // on item of random user
      otherActions = await saveActions(rawActionRepository, [
        { item: itemOfRandomUser, member: exportingActor },
        { item: itemOfRandomUser, member: exportingActor },
        { item: itemOfRandomUser, member: exportingActor },
      ]);

      // noise: save for a random user
      await saveActions(rawActionRepository, [{ item, member: randomUser }]);
      await saveActions(rawActionRepository, [{ item: itemOfRandomUser, member: randomUser }]);
    });

    it('get all Actions for the member', async () => {
      const result = await new ActionRepository().getForMember(exportingActor.id);

      console.log(result);

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
    let appActions: AppAction[], otherActions: AppAction[];

    beforeEach(async () => {
      // save for exporting actor
      appActions = await saveAppActions({ item, member: exportingActor });
      // on item of random user
      otherActions = await saveAppActions({ item: itemOfRandomUser, member: exportingActor });

      // noise: for a random member
      await saveAppActions({ item, member: randomUser });
      await saveAppActions({ item: itemOfRandomUser, member: randomUser });
    });

    it('get all AppActions for the member', async () => {
      const result = await AppActionRepository.getForMember(exportingActor.id);

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
    let appData: AppData[];
    let appDataWithActorAsMember: AppData[];
    let appDataWithOtherMember: AppData[];

    beforeEach(async () => {
      appData = await saveAppData({ item, creator: exportingActor });
      appDataWithActorAsMember = await saveAppData({
        item: itemOfRandomUser,
        creator: randomUser,
        member: exportingActor,
      });
      appDataWithOtherMember = await saveAppData({
        item,
        creator: exportingActor,
        member: randomUser,
      });

      // noise: for a random member
      await saveAppData({ item: itemOfRandomUser, creator: randomUser });
    });

    it('get all AppData for the member', async () => {
      const result = await AppDataRepository.getForMember(exportingActor.id);

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
    let appSettings: AppSetting[];

    beforeEach(async () => {
      appSettings = await saveAppSettings({ item, creator: exportingActor });
      // noise: for a random member
      await saveAppSettings({
        item: itemOfRandomUser,
        creator: randomUser,
      });
    });

    it('get all AppSettings for the member', async () => {
      const result = await AppSettingRepository.getForMember(exportingActor.id);

      expectObjects({
        results: result,
        expectations: appSettings,
        wantedProps: ['id', 'itemId', 'data', 'name', 'creatorId', 'createdAt', 'updatedAt'],
        // unwantedProps: ['item', 'creator'],
        typeName: 'AppSetting',
      });
    });
  });

  describe('ChatMention', () => {
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
});
