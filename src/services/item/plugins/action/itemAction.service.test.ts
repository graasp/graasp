import { faker } from '@faker-js/faker';
import { and, eq } from 'drizzle-orm';
import { v4 } from 'uuid';

import { FastifyInstance, FastifyRequest } from 'fastify';

import { Context, PermissionLevel } from '@graasp/sdk';

import build, {
  MOCK_LOGGER,
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { actionsTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { UnauthorizedMember } from '../../../../utils/errors';
import { ActionRepository } from '../../../action/action.repository';
import { ActionService } from '../../../action/action.service';
import { assertIsMemberForTest } from '../../../authentication';
import { ChatMessageRepository } from '../../../chat/chatMessage.repository';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { MemberService } from '../../../member/member.service';
import { ExportDataRepository } from '../../../member/plugins/export-data/memberExportData.repository';
import { BasicItemService } from '../../basic.service';
import { ItemService } from '../../item.service';
import { AppActionRepository } from '../app/appAction/appAction.repository';
import { AppDataRepository } from '../app/appData/appData.repository';
import { AppSettingRepository } from '../app/appSetting/repository';
import { ItemVisibilityRepository } from '../itemVisibility/repository';
import { ActionItemService } from './itemAction.service';
import { ItemActionType } from './utils';

const itemService = {} as ItemService;
const basicItemService = { get: jest.fn() } as unknown as BasicItemService;

const service = new ActionItemService(
  new ActionService(new ActionRepository(), {} as MemberService, MOCK_LOGGER),
  basicItemService,
  new ActionRepository(),
  new ItemMembershipRepository(),
  new AppActionRepository(),
  new AppSettingRepository(),
  new AppDataRepository(),
  new ChatMessageRepository(),
  new ExportDataRepository(),
  itemService as ItemService,
  new ItemVisibilityRepository(),
);

const getActionsByItemForType = async (itemId, type) => {
  return await db.query.actionsTable.findMany({
    where: and(eq(actionsTable.itemId, itemId), eq(actionsTable.type, type)),
  });
};

const MOCK_REQUEST = {
  headers: { origin: 'https://origin.com' },
  raw: {
    headers: { 'x-forwarded-for': '' },
    socket: { remoteAddress: 'address' },
  },
} as unknown as FastifyRequest;

describe('ActionItemService', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('getForItem', () => {
    it('throw for signed out user', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          { memberships: [{ account: { name: 'bob' } }] },
          {
            actions: [
              { account: 'actor', view: Context.Builder },
              { account: 'actor', view: Context.Builder },
              { account: 'actor', view: Context.Builder },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      jest.spyOn(basicItemService, 'get').mockResolvedValue({ ...item, creator: null });

      await service.getForItem(db, actor, item.id).catch((e) => {
        expect(e).toBeInstanceOf(UnauthorizedMember);
      });
    });

    describe('Signed in', () => {
      it('get actions for item for default view', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              actions: [
                {
                  account: 'actor',
                  view: Context.Builder,
                },
                {
                  account: 'actor',
                  view: Context.Builder,
                },
                {
                  account: 'actor',
                  view: Context.Builder,
                },
                { account: 'actor', view: Context.Player, createdAt: new Date().toISOString() },
                { account: 'actor', view: Context.Library },
                { account: 'actor', view: Context.Player },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        jest.spyOn(basicItemService, 'get').mockResolvedValue({ ...item, creator: null });
        const result = await service.getForItem(db, actor, item.id);

        expect(result).toHaveLength(3);
      });

      it('get actions for all members when admin', async () => {
        const {
          actor,
          actions,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              actions: [
                {
                  account: 'actor',
                  view: Context.Builder,
                },
                {
                  account: 'actor',
                  view: Context.Builder,
                },
                {
                  account: 'actor',
                  view: Context.Builder,
                },
                {
                  account: { name: 'bob' },
                  view: Context.Builder,
                },
                {
                  account: { name: 'bob' },
                  view: Context.Builder,
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        jest.spyOn(basicItemService, 'get').mockResolvedValue({ ...item, creator: null });

        const result = await service.getForItem(db, actor, item.id);

        expect(result).toHaveLength(actions.length);
      });

      it('get only own actions for when writer', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              actions: [
                {
                  account: { name: 'bob' },
                  view: Context.Builder,
                },
                {
                  account: { name: 'bob' },
                  view: Context.Builder,
                },
                { account: 'actor', view: Context.Builder },
                { account: 'actor', view: Context.Player },
                { account: 'actor', view: Context.Library },
                { account: 'actor', view: Context.Player },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        jest.spyOn(basicItemService, 'get').mockResolvedValue({ ...item, creator: null });

        const result = await service.getForItem(db, actor, item.id);

        // get for own and default view builder
        expect(result).toHaveLength(1);
      });

      it('get actions for given sample size', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              actions: [
                {
                  account: { name: 'bob' },
                },
                { account: 'actor', view: Context.Builder },
                { account: 'actor', view: Context.Library },
                { account: 'actor', view: Context.Builder },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        jest.spyOn(basicItemService, 'get').mockResolvedValue({ ...item, creator: null });

        const result = await service.getForItem(db, actor, item.id, {
          sampleSize: 2,
        });

        expect(result).toHaveLength(2);
      });

      it('get actions for given view', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              actions: [
                { account: 'actor', view: Context.Player },
                { account: 'actor', view: Context.Library },
                { account: 'actor', view: Context.Player },
                { account: 'actor', view: Context.Player },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        jest.spyOn(basicItemService, 'get').mockResolvedValue({ ...item, creator: null });

        const result = await service.getForItem(db, actor, item.id, {
          view: Context.Player,
        });

        expect(result).toHaveLength(3);
      });
    });
  });

  // describe('getAnalyticsAggregation', () => {
  //   beforeEach(async () => {
  //     actor = await saveMember();
  //     mockAuthenticate(actor);
  //     const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
  //     // todo: update when testing memberships
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //     item = i as any;
  //   });
  //   it('throw if no access to item', async () => {
  //     const bob = await saveMember();
  //     const { item: itemNoMembership } = await testUtils.saveItemAndMembership({ member: bob });
  //     // todo: update when testing memberships
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //     const itemAny = itemNoMembership as any;
  //     await saveActions([
  //       { item: itemAny, account: actor, view: Context.Builder },
  //       { item: itemAny, account: actor, view: Context.Builder },
  //       { item: itemAny, account: actor, view: Context.Builder },
  //     ]);
  //     await service
  //       .getAnalyticsAggregation(db, actor, {
  //         itemId: item.id,
  //         countGroupBy: [CountGroupBy.ActionLocation],
  //         aggregationParams: {
  //           aggregateFunction: AggregateFunction.Avg,
  //           aggregateMetric: AggregateMetric.ActionCount,
  //         },
  //       })
  //       .catch((e) => {
  //         expect(e).toBeInstanceOf(MemberCannotAccess);
  //       });
  //   });
  //   it('get aggregated actions', async () => {
  //     await saveActions([
  //       {
  //         item,
  //         account: actor,
  //         view: Context.Player,
  //         createdAt: formatISO(addDays(new Date(), -1)),
  //       },
  //       {
  //         item,
  //         account: actor,
  //         view: Context.Player,
  //         createdAt: formatISO(addDays(new Date(), -1)),
  //       },
  //       {
  //         item,
  //         account: actor,
  //         view: Context.Player,
  //         createdAt: formatISO(addDays(new Date(), -1)),
  //       },
  //     ]);
  //     // noise
  //     await saveActions([
  //       { item, account: actor, view: Context.Builder },
  //       { item, account: actor, view: Context.Library },
  //       { item, account: actor, view: Context.Builder },
  //     ]);
  //     const result = await service.getAnalyticsAggregation(db, actor, {
  //       itemId: item.id,
  //       view: Context.Player,
  //       countGroupBy: [CountGroupBy.User],
  //     });
  //     expect(result).toMatchObject([{ actionCount: '3', user: actor.id }]);
  //   });

  //   it('get aggregated actions within specific period', async () => {
  //     await saveActions([
  //       {
  //         item,
  //         account: actor,
  //         view: Context.Player,
  //         createdAt: new Date('2024-06-08').toISOString(),
  //       },
  //       {
  //         item,
  //         account: actor,
  //         view: Context.Player,
  //         createdAt: new Date('2024-07-08').toISOString(),
  //       },
  //       {
  //         item,
  //         account: actor,
  //         view: Context.Player,
  //         createdAt: new Date('2024-06-18').toISOString(),
  //       },
  //     ]);
  //     // noise
  //     await saveActions([
  //       { item, account: actor, view: Context.Builder },
  //       { item, account: actor, view: Context.Library },
  //       { item, account: actor, view: Context.Builder },
  //     ]);
  //     const result = await service.getAnalyticsAggregation(db, actor, {
  //       itemId: item.id,
  //       view: Context.Player,
  //       countGroupBy: [CountGroupBy.User],
  //       startDate: new Date('2024-07-01').toISOString(),
  //       endDate: new Date('2024-07-10').toISOString(),
  //     });
  //     expect(result).toMatchObject([{ actionCount: '1', user: actor.id }]);
  //   });
  // });

  // describe('getBaseAnalyticsForItem', () => {
  //   beforeEach(async () => {
  //     actor = await saveMember();
  //     mockAuthenticate(actor);
  //     const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
  //     // todo: update when testing memberships
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //     item = i as any;
  //   });

  //   it('throw if no access to item', async () => {
  //     const bob = await saveMember();
  //     const { item: itemNoMembership } = await testUtils.saveItemAndMembership({ member: bob });
  //     // todo: update when testing memberships
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //     const itemAny = itemNoMembership as any;
  //     await saveActions([
  //       { item: itemAny, account: actor, view: Context.Builder },
  //       { item: itemAny, account: actor, view: Context.Builder },
  //       { item: itemAny, account: actor, view: Context.Builder },
  //     ]);
  //     await service
  //       .getBaseAnalyticsForItem(db, actor, {
  //         itemId: item.id,
  //       })
  //       .catch((e) => {
  //         expect(e).toBeInstanceOf(MemberCannotAccess);
  //       });
  //   });

  //   it('get only own analytics', async () => {
  //     const sampleSize = 5;
  //     const bob = await saveMember();
  //     await testUtils.saveMembership({ account: bob, item, permission: PermissionLevel.Write });
  //     const { item: itemNoMembership } = await testUtils.saveItemAndMembership({
  //       member: bob,
  //       creator: actor,
  //     });

  //     // actions
  //     // todo: update when testing memberships
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //     const itemAny = itemNoMembership as any;
  //     const actions = await saveActions([
  //       { item, account: bob, view: Context.Player, createdAt: formatISO(addDays(new Date(), -1)) },
  //       {
  //         item,
  //         account: bob,
  //         view: Context.Player,
  //         createdAt: formatISO(addDays(new Date(), -10)),
  //       },
  //       { item, account: bob, view: Context.Player, createdAt: formatISO(addDays(new Date(), -5)) },
  //     ]);

  //     // noise
  //     await saveActions([
  //       { item: itemAny, account: actor, view: Context.Builder },
  //       { item: itemAny, account: actor, view: Context.Builder },
  //       { item: itemAny, account: actor, view: Context.Builder },
  //     ]);

  //     // descendants
  //     await testUtils.saveItems({ nb: 3, parentItem: item, member: bob });

  //     const baseAnalytics = await service.getBaseAnalyticsForItem(
  //       db,
  //       bob,

  //       {
  //         itemId: item.id,
  //         sampleSize,
  //       },
  //     );
  //     expect(baseAnalytics.actions).toHaveLength(actions.length);
  //     expect(baseAnalytics.item.id).toEqual(item.id);
  //     expect(baseAnalytics.item.name).toEqual(item.name);
  //     expect(baseAnalytics.item.creator?.name).toEqual(item.creator.name);
  //     expect(baseAnalytics.descendants).toHaveLength(3);
  //     expect(baseAnalytics.metadata).toMatchObject({
  //       numActionsRetrieved: actions.length,
  //       requestedSampleSize: sampleSize,
  //     });
  //     expect(baseAnalytics.itemMemberships).toHaveLength(2);
  //   });

  //   it('get analytics within specific period', async () => {
  //     const sampleSize = 5;

  //     // actions
  //     await saveActions([
  //       {
  //         item,
  //         account: actor,
  //         view: Context.Player,
  //         createdAt: new Date('2024-06-01').toISOString(),
  //       },
  //       {
  //         item,
  //         account: actor,
  //         view: Context.Player,
  //         createdAt: new Date('2024-07-02').toISOString(),
  //       },
  //       {
  //         item,
  //         account: actor,
  //         view: Context.Player,
  //         createdAt: new Date('2024-07-11').toISOString(),
  //       },
  //     ]);

  //     const baseAnalytics = await service.getBaseAnalyticsForItem(
  //       db,
  //       actor,

  //       {
  //         itemId: item.id,
  //         sampleSize,
  //         startDate: new Date('2024-07-01').toISOString(),
  //         endDate: new Date('2024-07-10').toISOString(),
  //       },
  //     );
  //     expect(baseAnalytics.actions).toHaveLength(1);
  //     expect(baseAnalytics.item.id).toEqual(item.id);
  //   });

  //   it('get item data for app actions', async () => {
  //     const { item } = await testUtils.saveItemAndMembership({
  //       item: { type: ItemType.APP },
  //       member: actor,
  //     });

  //     // app actions
  //     await saveAppActions({ item, member: actor });

  //     const baseAnalytics = await service.getBaseAnalyticsForItem(
  //       db,
  //       actor,

  //       {
  //         itemId: item.id,
  //       },
  //     );
  //     for (const appAction of baseAnalytics.apps[item.id].actions) {
  //       expectItem(appAction.item, item);
  //     }
  //   });
  // });

  describe('post actions', () => {
    it('postPostAction', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });

      await service.postPostAction(db, MOCK_REQUEST, item);
      const actions = await getActionsByItemForType(item.id, ItemActionType.Create);
      expect(actions).toHaveLength(1);
    });

    it('postPatchAction', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });

      const body = { name: faker.word.sample() };
      await service.postPatchAction(db, { ...MOCK_REQUEST, body }, item);
      const actions = await getActionsByItemForType(item.id, ItemActionType.Update);
      expect(actions).toHaveLength(1);
      expect(actions[0].extra).toMatchObject({ itemId: item.id, body });
    });

    it('postManyDeleteAction', async () => {
      const {
        items: [item1, item2],
        actor,
      } = await seedFromJson({
        items: [
          { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
          { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      await service.postManyDeleteAction(db, MOCK_REQUEST, [item1, item2]);

      // cannot use getActionsByItemForType because item prop is not defined because item is deleted
      const actions = await db.query.actionsTable.findMany({
        where: eq(actionsTable.type, ItemActionType.Delete),
      });
      expect(
        actions.filter((a) => (a.extra as { itemId: string }).itemId === item1.id),
      ).toHaveLength(1);
      expect(
        actions.filter((a) => (a.extra as { itemId: string }).itemId === item2.id),
      ).toHaveLength(1);
    });

    it('postManyMoveAction', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] }],
      });

      const body = { parentId: v4() };
      await service.postManyMoveAction(db, { ...MOCK_REQUEST, body }, [item, item]);
      const actions = await getActionsByItemForType(item.id, ItemActionType.Move);
      expect(actions).toHaveLength(2);
      expect(actions[0].extra).toMatchObject({ itemId: item.id, body });
      expect(actions[1].extra).toMatchObject({ itemId: item.id, body });
    });

    it('postManyCopyAction', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });

      const body = { parentId: v4() };
      await service.postManyCopyAction(db, { ...MOCK_REQUEST, body }, [item, item]);
      const actions = await getActionsByItemForType(item.id, ItemActionType.Copy);
      expect(actions).toHaveLength(2);
      expect(actions[0].extra).toMatchObject({ itemId: item.id, body });
      expect(actions[1].extra).toMatchObject({ itemId: item.id, body });
    });
  });
});
