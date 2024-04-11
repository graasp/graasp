import build, { clearDatabase } from '../../../../../../test/app';
import { AppDataSource } from '../../../../../plugins/datasource';
import { buildRepositories } from '../../../../../utils/repositories';
import { Action } from '../../../../action/entities/action';
import { ActionRepository } from '../../../../action/repositories/action';
import { saveActions } from '../../../../action/test/fixtures/actions';
import { ItemTestUtils } from '../../../../item/test/fixtures/items';
import { saveMember } from '../../../test/fixtures/members';
import { DataMemberService } from '../service';
import { expectNotLeakMemberId } from './fixtures/data';
import { saveAppActions, saveAppData } from './fixtures/temp';

const itemTestUtils = new ItemTestUtils();

jest.mock('../../../../plugins/datasource');

const service = new DataMemberService();

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

    beforeEach(async () => {
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
    });

    it('member id is not leak', async () => {
      const result = await new ActionRepository().getForMember(exportingActor.id);

      result.forEach((a) => {
        expectNotLeakMemberId({
          resource: a,
          memberId: exportingActor.id,
          exportActorId: exportingActor.id,
          memberIdKey: ['memberId'],
        });
      });
    });
  });

  describe('AppActions', () => {
    beforeEach(async () => {
      // save for exporting actor
      await saveAppActions({ item, member: exportingActor });
      // on item of random user
      await saveAppActions({ item: itemOfRandomUser, member: exportingActor });

      // noise: for a random member
      await saveAppActions({ item, member: randomUser });
      await saveAppActions({ item: itemOfRandomUser, member: randomUser });
    });

    it('member id is not leak', async () => {
      const result = await new ActionRepository().getForMember(exportingActor.id);

      result.forEach((a) => {
        expectNotLeakMemberId({
          resource: a,
          exportActorId: exportingActor.id,
          memberId: exportingActor.id,
          memberIdKey: ['memberId'],
        });
      });
    });
  });

  describe('AppData', () => {
    beforeEach(async () => {
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
    });

    it('member id is not leak', async () => {
      const result = await service.getAppData(exportingActor, buildRepositories());
      expect(result.length).toBeGreaterThan(0);
      result.forEach((resource) => {
        expectNotLeakMemberId({
          resource,
          exportActorId: exportingActor.id,
          memberId: randomUser.id,
          memberIdKey: ['memberId', 'creatorId'],
        });
      });
    });
  });
});
