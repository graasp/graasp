import { MemberFactory } from '../../../../../../test/factories/member.factory';
import { db } from '../../../../../drizzle/db';
import { MinimalMember } from '../../../../../types';
import { ChatMessageWithMentionFactory } from '../../../../chat/test/fixtures';
import { ExportDataRepository } from '../repository';
import { ExportMemberDataService } from '../service';
import { RequestDataExportService } from '../utils/export.utils';
import { expectNoLeakMemberId } from './fixtures';

/**
 * The service tests ensure that no member id of other members are leaked during the export.
 */

const exportDataRepository = new ExportDataRepository();

const service = new ExportMemberDataService({} as RequestDataExportService, exportDataRepository);

const checkNoMemberIdLeaks = <T>({
  results,
  exportingActor,
  randomUser,
}: {
  results: T[];
  exportingActor: MinimalMember;
  randomUser: MinimalMember;
}) => {
  expect(results.length).toBeGreaterThan(0);

  results.forEach((resource) => {
    expectNoLeakMemberId({
      resource,
      exportActorId: exportingActor.id,
      memberId: randomUser.id,
    });
  });
};

describe('DataMember Export', () => {
  afterEach(async () => {
    jest.clearAllMocks();
  });

  // TODO: remove? it does not do much in the service
  // describe('Actions', () => {
  //   it('member id is not leak', async () => {
  //     // save for exporting actor
  //     await saveActions([
  //       { item, account: exportingActor },
  //       { item, account: exportingActor },
  //       { item, account: exportingActor },
  //     ]);
  //     // on item of random user
  //     await saveActions([
  //       { item: itemOfRandomUser, account: exportingActor },
  //       { item: itemOfRandomUser, account: exportingActor },
  //       { item: itemOfRandomUser, account: exportingActor },
  //     ]);

  //     // noise: save for a random user
  //     await saveActions([{ item, account: randomUser }]);
  //     await saveActions([{ item: itemOfRandomUser, account: randomUser }]);

  //     const results = await service.getActions(app.db, exportingActor);
  //     checkNoMemberIdLeaks({ results, exportingActor, randomUser });
  //   });
  // });

  // describe('AppActions', () => {
  //   it('member id is not leak', async () => {
  //     // save for exporting actor
  //     await saveAppActions({ item, member: exportingActor });
  //     // on item of random user
  //     await saveAppActions({ item: itemOfRandomUser, member: exportingActor });

  //     // noise: for a random member
  //     await saveAppActions({ item, member: randomUser });
  //     await saveAppActions({ item: itemOfRandomUser, member: randomUser });

  //     const results = await service.getAppActions(app.db, exportingActor);
  //     checkNoMemberIdLeaks({ results, exportingActor, randomUser });
  //   });
  // });

  // describe('AppData', () => {
  //   it('member id is not leak', async () => {
  //     // save regular app data
  //     await saveAppData({ item, creator: exportingActor });
  //     // save app data where the creator is a random user
  //     await saveAppData({
  //       item: itemOfRandomUser,
  //       creator: randomUser,
  //       account: exportingActor,
  //     });
  //     // save app data where member is a random user
  //     await saveAppData({
  //       item,
  //       creator: exportingActor,
  //       account: randomUser,
  //     });

  //     // noise: for a random member
  //     await saveAppData({ item: itemOfRandomUser, creator: randomUser });

  //     const results = await service.getAppData(app.db, exportingActor);
  //     checkNoMemberIdLeaks({ results, exportingActor, randomUser });
  //   });
  // });

  // describe('AppSettings', () => {
  //   it('member id is not leak', async () => {
  //     await saveAppSettings({ item, creator: exportingActor });
  //     // noise: the creator is a random user
  //     await saveAppSettings({
  //       item: itemOfRandomUser,
  //       creator: randomUser,
  //     });

  //     const results = await service.getAppSettings(app.db, exportingActor);
  //     checkNoMemberIdLeaks({ results, exportingActor, randomUser });
  //   });
  // });

  describe('Chat', () => {
    describe('ChatMentions', () => {
      it('another member id is not leak', async () => {
        const actor = MemberFactory();
        const member1 = MemberFactory();

        // returns mention to self without creator
        const { chatMention, chatMessage } = ChatMessageWithMentionFactory({
          creator: member1,
          mentionMember: actor,
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { creatorId, ...cm } = chatMessage;

        jest
          .spyOn(exportDataRepository, 'getChatMentions')
          .mockResolvedValue([{ ...chatMention, message: cm }]);

        const results = await service.getChatMentions(db, actor);

        checkNoMemberIdLeaks({ results, exportingActor: actor, randomUser: member1 });
      });
    });
    describe('ChatMessages', () => {
      it('member id is not leak', async () => {
        const actor = MemberFactory();
        const member1 = MemberFactory();
        const member2 = MemberFactory();
        const member3 = MemberFactory();

        jest.spyOn(exportDataRepository, 'getChatMessages').mockResolvedValue([
          ChatMessageWithMentionFactory({
            creator: actor,
            mentionMember: member1,
          }).chatMessage,
          ChatMessageWithMentionFactory({
            creator: actor,
            mentionMember: member2,
          }).chatMessage,
          ChatMessageWithMentionFactory({
            creator: actor,
            mentionMember: member3,
          }).chatMessage,
        ]);

        const results = await service.getChatMessages(db, actor);

        checkNoMemberIdLeaks({ results, exportingActor: actor, randomUser: member1 });
        checkNoMemberIdLeaks({ results, exportingActor: actor, randomUser: member2 });
        checkNoMemberIdLeaks({ results, exportingActor: actor, randomUser: member3 });
      });
    });
  });

  // TODO: remove? it does not do much in the service
  // describe('Item', () => {
  //   describe('Items', () => {
  //     it('member id is not leak', async () => {
  //       await itemTestUtils.saveItem({ actor: exportingActor });
  //       await itemTestUtils.saveItem({ actor: exportingActor });
  //       await itemTestUtils.saveItem({ actor: exportingActor });
  //       await itemTestUtils.saveItem({ actor: randomUser });
  //       await itemTestUtils.saveItem({ actor: randomUser });

  //       const results = await service.getItems(app.db, exportingActor);
  //       checkNoMemberIdLeaks({ results, exportingActor, randomUser });
  //     });
  //   });

  //   describe('ItemFavorites', () => {
  //     it('member id is not leak', async () => {
  //       const items = [
  //         await itemTestUtils.saveItem({ actor: exportingActor }),
  //         await itemTestUtils.saveItem({ actor: exportingActor }),
  //         await itemTestUtils.saveItem({ actor: exportingActor }),
  //       ];
  //       await saveItemFavorites({
  //         items,
  //         member: exportingActor,
  //       });
  //       // noise:
  //       await saveItemFavorites({
  //         items,
  //         member: randomUser,
  //       });

  //       const results = await service.getItemFavorites(app.db, exportingActor);
  //       checkNoMemberIdLeaks({ results, exportingActor, randomUser });
  //     });
  //   });

  //   describe('ItemLikes', () => {
  //     it('member id is not leak', async () => {
  //       // TODO: mabye insert beforeEach the items...
  //       const items = [
  //         await itemTestUtils.saveItem({ actor: exportingActor }),
  //         await itemTestUtils.saveItem({ actor: exportingActor }),
  //         await itemTestUtils.saveItem({ actor: exportingActor }),
  //       ];
  //       await saveItemLikes(items, exportingActor);
  //       // noise:
  //       await saveItemLikes(items, randomUser);

  //       const results = await service.getItemLikes(app.db, exportingActor);
  //       checkNoMemberIdLeaks({ results, exportingActor, randomUser });
  //     });
  //   });

  //   describe('ItemMembership', () => {
  //     it('member id is not leak', async () => {
  //       // TODO: mabye insert beforeEach the items...
  //       const actorItems = [
  //         await itemTestUtils.saveItem({ actor: exportingActor }),
  //         await itemTestUtils.saveItem({ actor: exportingActor }),
  //         await itemTestUtils.saveItem({ actor: exportingActor }),
  //       ];
  //       const randomItems = [
  //         await itemTestUtils.saveItem({ actor: randomUser }),
  //         await itemTestUtils.saveItem({ actor: randomUser }),
  //       ];

  //       const memberships: ItemMembershipRaw[] = [];

  //       for (const item of actorItems) {
  //         const membership = await itemTestUtils.saveMembership({
  //           item,
  //           account: exportingActor,
  //           permission: PermissionLevel.Admin,
  //         });
  //         memberships.push(membership);
  //       }

  //       for (const item of randomItems) {
  //         const membership = await itemTestUtils.saveMembership({
  //           item,
  //           account: exportingActor,
  //           permission: PermissionLevel.Read,
  //         });
  //         memberships.push(membership);
  //       }

  //       // noise
  //       await itemTestUtils.saveItemAndMembership({ creator: exportingActor, member: randomUser });
  //       await itemTestUtils.saveItemAndMembership({ creator: exportingActor, member: randomUser });
  //       await itemTestUtils.saveItemAndMembership({
  //         creator: exportingActor,
  //         member: randomUser,
  //         permission: PermissionLevel.Read,
  //       });

  //       const results = await service.getItemsMemberShips(app.db, exportingActor);
  //       checkNoMemberIdLeaks({ results, exportingActor, randomUser });
  //     });
  //   });
  // });
});
