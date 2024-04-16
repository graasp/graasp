import build, { clearDatabase } from '../../../../../../test/app';
import { AppDataSource } from '../../../../../plugins/datasource';
import { buildRepositories } from '../../../../../utils/repositories';
import { Action } from '../../../../action/entities/action';
import { saveActions } from '../../../../action/test/fixtures/actions';
import { saveAppActions } from '../../../../item/plugins/app/appAction/test/fixtures';
import { saveAppData } from '../../../../item/plugins/app/appData/test/fixtures';
import { saveAppSettings } from '../../../../item/plugins/app/appSetting/test/fixtures';
import {
  saveCategories,
  saveItemCategories,
} from '../../../../item/plugins/itemCategory/test/fixtures';
import { saveItemLikes } from '../../../../item/plugins/itemLike/test/utils';
import { ItemTestUtils } from '../../../../item/test/fixtures/items';
import { Member } from '../../../entities/member';
import { saveMember } from '../../../test/fixtures/members';
import { DataMemberService } from '../service';
import { expectNotLeakMemberId, saveChatMessages, saveItemFavorites } from './fixtures';

/**
 * The service tests ensure that no member id of other members are leaked during the export.
 */

const itemTestUtils = new ItemTestUtils();

jest.mock('../../../../../plugins/datasource');

const service = new DataMemberService();

const checkNoMemberIdLeaks = <T>({
  results,
  exportingActor,
  randomUser,
}: {
  results: T[];
  exportingActor: Member;
  randomUser: Member;
}) => {
  expect(results.length).toBeGreaterThan(0);

  results.forEach((resource) => {
    expectNotLeakMemberId({
      resource,
      exportActorId: exportingActor.id,
      memberId: randomUser.id,
    });
  });
};

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

    it('member id is not leak', async () => {
      // save for exporting actor
      await saveActions(rawActionRepository, [
        { item, member: exportingActor },
        { item, member: exportingActor },
        { item, member: exportingActor },
      ]);
      // on item of random user
      await saveActions(rawActionRepository, [
        { item: itemOfRandomUser, member: exportingActor },
        { item: itemOfRandomUser, member: exportingActor },
        { item: itemOfRandomUser, member: exportingActor },
      ]);

      // noise: save for a random user
      await saveActions(rawActionRepository, [{ item, member: randomUser }]);
      await saveActions(rawActionRepository, [{ item: itemOfRandomUser, member: randomUser }]);

      const results = await service.getActions(exportingActor, buildRepositories());
      checkNoMemberIdLeaks({ results, exportingActor, randomUser });
    });
  });

  describe('AppActions', () => {
    it('member id is not leak', async () => {
      // save for exporting actor
      await saveAppActions({ item, member: exportingActor });
      // on item of random user
      await saveAppActions({ item: itemOfRandomUser, member: exportingActor });

      // noise: for a random member
      await saveAppActions({ item, member: randomUser });
      await saveAppActions({ item: itemOfRandomUser, member: randomUser });

      const results = await service.getAppActions(exportingActor, buildRepositories());
      checkNoMemberIdLeaks({ results, exportingActor, randomUser });
    });
  });

  describe('AppData', () => {
    it('member id is not leak', async () => {
      // save regular app data
      await saveAppData({ item, creator: exportingActor });
      // save app data where the creator is a random user
      await saveAppData({
        item: itemOfRandomUser,
        creator: randomUser,
        member: exportingActor,
      });
      // save app data where member is a random user
      await saveAppData({
        item,
        creator: exportingActor,
        member: randomUser,
      });

      // noise: for a random member
      await saveAppData({ item: itemOfRandomUser, creator: randomUser });

      const results = await service.getAppData(exportingActor, buildRepositories());
      checkNoMemberIdLeaks({ results, exportingActor, randomUser });
    });
  });

  describe('AppSettings', () => {
    it('member id is not leak', async () => {
      await saveAppSettings({ item, creator: exportingActor });
      // noise: the creator is a random user
      await saveAppSettings({
        item: itemOfRandomUser,
        creator: randomUser,
      });

      const results = await service.getAppSettings(exportingActor, buildRepositories());
      checkNoMemberIdLeaks({ results, exportingActor, randomUser });
    });
  });

  describe('Chat', () => {
    beforeEach(async () => {
      await saveChatMessages({ item, creator: exportingActor, mentionMember: randomUser });
      await saveChatMessages({
        item: itemOfRandomUser,
        creator: randomUser,
        mentionMember: exportingActor,
      });
    });
    describe('ChatMentions', () => {
      it('member id is not leak', async () => {
        const results = await service.getChatMentions(exportingActor, buildRepositories());
        checkNoMemberIdLeaks({ results, exportingActor, randomUser });
      });
    });
    describe('ChatMessages', () => {
      it('member id is not leak', async () => {
        const results = await service.getChatMessages(exportingActor, buildRepositories());
        checkNoMemberIdLeaks({ results, exportingActor, randomUser });
      });
    });
  });

  describe('Item', () => {
    describe('Items', () => {
      it('member id is not leak', async () => {
        await itemTestUtils.saveItem({ actor: exportingActor });
        await itemTestUtils.saveItem({ actor: exportingActor });
        await itemTestUtils.saveItem({ actor: exportingActor });
        await itemTestUtils.saveItem({ actor: randomUser });
        await itemTestUtils.saveItem({ actor: randomUser });

        const results = await service.getItems(exportingActor, buildRepositories());
        checkNoMemberIdLeaks({ results, exportingActor, randomUser });
      });
    });

    describe('ItemCategories', () => {
      it('member id is not leak', async () => {
        await saveItemCategories({
          item,
          categories: await saveCategories(),
          creator: exportingActor,
        });

        const results = await service.getItemCategories(exportingActor, buildRepositories());
        checkNoMemberIdLeaks({ results, exportingActor, randomUser });
      });
    });

    describe('ItemFavorites', () => {
      it('member id is not leak', async () => {
        const items = [
          await itemTestUtils.saveItem({ actor: exportingActor }),
          await itemTestUtils.saveItem({ actor: exportingActor }),
          await itemTestUtils.saveItem({ actor: exportingActor }),
        ];
        await saveItemFavorites({
          items,
          member: exportingActor,
        });
        // noise:
        await saveItemFavorites({
          items,
          member: randomUser,
        });

        const results = await service.getItemFavorites(exportingActor, buildRepositories());
        checkNoMemberIdLeaks({ results, exportingActor, randomUser });
      });
    });

    describe('ItemLikes', () => {
      it('member id is not leak', async () => {
        // TODO: mabye insert beforeEach the items...
        const items = [
          await itemTestUtils.saveItem({ actor: exportingActor }),
          await itemTestUtils.saveItem({ actor: exportingActor }),
          await itemTestUtils.saveItem({ actor: exportingActor }),
        ];
        await saveItemLikes(items, exportingActor);
        // noise:
        await saveItemLikes(items, randomUser);

        const results = await service.getItemLikes(exportingActor, buildRepositories());
        checkNoMemberIdLeaks({ results, exportingActor, randomUser });
      });
    });
  });
});
