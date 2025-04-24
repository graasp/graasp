import { and, eq } from 'drizzle-orm';

import { Context } from '@graasp/sdk';

import { ActionFactory } from '../../../test/factories/action.factory';
import { SeedActor, seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { actionsTable } from '../../drizzle/schema';
import { assertIsDefined } from '../../utils/assertions';
import { assertIsMemberForTest } from '../authentication';
import { getPreviousMonthFromNow } from '../member/plugins/action/memberAction.service';
import { ActionRepository } from './action.repository';
import { DEFAULT_ACTIONS_SAMPLE_SIZE } from './constants';
import { expectActions } from './test/fixtures/actions';

const actionRepository = new ActionRepository();

const getActionsByAccountId = async (accountId: string) => {
  return await db.query.actionsTable.findMany({ where: eq(actionsTable.accountId, accountId) });
};

describe('Action Repository', () => {
  describe('postMany', () => {
    it('save many actions', async () => {
      const actions = [ActionFactory(), ActionFactory(), ActionFactory(), ActionFactory()];

      await actionRepository.postMany(db, actions);

      for (const a of actions) {
        const savedAction = await db.query.actionsTable.findFirst({
          where: and(eq(actionsTable.type, a.type), eq(actionsTable.view, a.view)),
        });
        expect(savedAction).toBeDefined();
      }
    });
  });

  describe('deleteAllForAccount', () => {
    it('delete all actions for member', async () => {
      const {
        actor,
        members: [bob],
      } = await seedFromJson({
        actions: [
          { account: 'actor' },
          { account: 'actor' },
          { account: 'actor' },
          { account: 'actor' },
          // noise
          { account: { name: 'bob' } },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      expect(await getActionsByAccountId(actor.id)).toHaveLength(4);

      await actionRepository.deleteAllForAccount(db, actor.id);

      expect(await getActionsByAccountId(actor.id)).toHaveLength(0);
      // contains at least bob's actions
      expect(await getActionsByAccountId(bob.id)).toHaveLength(1);
    });
  });

  describe('getAccountActions', () => {
    it('get actions for member within the last month', async () => {
      const { actor } = await seedFromJson({
        actions: [
          {
            account: 'actor',
            createdAt: new Date(),
          },
          {
            account: 'actor',
            createdAt: new Date(),
          },
          {
            createdAt: new Date('1999-07-08'),
            account: 'actor',
          },
          {
            account: 'actor',
            createdAt: new Date(),
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const result = await actionRepository.getAccountActions(db, actor.id, {
        startDate: getPreviousMonthFromNow(),
        endDate: new Date(),
      });

      expect(result.length).toEqual(3);
    });
  });

  describe('getForItem', () => {
    it('get all actions for item', async () => {
      const {
        actions,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            actions: [
              { account: 'actor', createdAt: new Date('2025-03-25T13:02:29.210Z') },
              { account: 'actor', createdAt: new Date('2025-03-25T13:02:29.210Z') },
            ],
          },
        ],
      });

      const result = await actionRepository.getForItem(db, item.path);

      expectActions(
        result,
        actions.map((a) => ({ ...a, item })),
      );
    });

    it('get all actions for item for max sampleSize', async () => {
      const {
        actions: [action1, action2, actions3],
        items: [item],
      } = await seedFromJson({
        items: [
          {
            actions: [
              { account: 'actor', createdAt: new Date('2025-03-25T12:02:29.210Z') },
              { account: 'actor', createdAt: new Date('2025-03-25T13:02:29.210Z') },
              { account: 'actor', createdAt: new Date('2025-03-25T13:02:29.210Z') },
              // noise - out of sample size because is older
              { account: 'actor', createdAt: new Date('2025-03-25T11:02:29.210Z') },
              // noise - out of date range
              { account: 'actor', createdAt: new Date('2020-03-25T13:02:29.210Z') },
              { account: 'actor', createdAt: new Date('2020-03-25T13:02:29.210Z') },
            ],
          },
        ],
      });

      const sampleSize = 3;
      const result = await actionRepository.getForItem(db, item.path, {
        sampleSize,
      });

      expectActions(result, [
        { ...action1, item },
        { ...action2, item },
        { ...actions3, item },
      ]);
    });

    it('get all actions for item for default sampleSize', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [
          {
            actions: [
              ...Array.from({ length: DEFAULT_ACTIONS_SAMPLE_SIZE }, () => ({
                account: 'actor' as SeedActor,
                createdAt: new Date('2025-03-25T13:02:29.210Z'),
              })),
              // noise - out of date range
              { account: 'actor', createdAt: new Date('2020-03-25T13:02:29.210Z') },
              { account: 'actor', createdAt: new Date('2020-03-25T13:02:29.210Z') },
            ],
          },
        ],
      });

      const result = await actionRepository.getForItem(db, item.path);

      expect(result).toHaveLength(DEFAULT_ACTIONS_SAMPLE_SIZE);
    });

    it('get all actions for item for view', async () => {
      const view = Context.Builder;

      const {
        actions: [action1, action2, actions3],
        items: [item],
      } = await seedFromJson({
        items: [
          {
            actions: [
              {
                view,
                account: 'actor',
                createdAt: new Date('2025-03-25T12:02:29.210Z'),
              },
              {
                view,
                account: 'actor',
                createdAt: new Date('2025-03-25T13:02:29.210Z'),
              },
              {
                view,
                account: 'actor',
                createdAt: new Date('2025-03-25T13:02:29.210Z'),
              },
              // noise - another view
              { view: Context.Account, account: 'actor' },
              { view: Context.Library, account: 'actor' },
            ],
          },
        ],
      });

      const result = await actionRepository.getForItem(db, item.path, { view });

      expectActions(
        result,
        [action1, action2, actions3].map((a) => ({ ...a, item })),
      );
    });

    it('get all actions for item for member Id', async () => {
      const {
        actions: [action1, action2, actions3],
        items: [item],
        members: [member],
      } = await seedFromJson({
        items: [
          {
            actions: [
              {
                account: { name: 'bob' },
                createdAt: new Date('2025-03-25T12:02:29.210Z'),
              },
              {
                account: { name: 'bob' },
                createdAt: new Date('2025-03-25T13:02:29.210Z'),
              },
              {
                account: { name: 'bob' },
                createdAt: new Date('2025-03-25T13:02:29.210Z'),
              },
              // noise - another account
              { account: 'actor' },
              { account: 'actor' },
            ],
          },
        ],
      });

      const result = await actionRepository.getForItem(db, item.path, {
        accountId: member.id,
      });

      expectActions(
        result,
        [action1, action2, actions3].map((a) => ({ ...a, item })),
      );
    });

    it('get all actions for item and its descendants', async () => {
      const {
        actions: [action1, action2, action3, action4, action5],
        items: [parent, item],
      } = await seedFromJson({
        items: [
          {
            actions: [
              { account: 'actor', createdAt: new Date('2025-03-25T12:02:29.210Z') },
              { account: 'actor', createdAt: new Date('2025-03-25T13:02:29.210Z') },
              { account: 'actor', createdAt: new Date('2025-03-25T13:02:29.210Z') },
            ],
            children: [
              {
                actions: [
                  {
                    account: { name: 'bob' },
                    createdAt: new Date('2025-03-25T12:02:29.210Z'),
                  },
                  {
                    account: { name: 'bob' },
                    createdAt: new Date('2025-03-25T13:02:29.210Z'),
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = await actionRepository.getForItem(db, parent.path);

      expectActions(result, [
        { ...action1, item: parent },
        { ...action2, item: parent },
        { ...action3, item: parent },
        { ...action4, item },
        { ...action5, item },
      ]);
    });
  });

  describe('getAggregationForItem', () => {
    //   it('returns nothing for no parameter', async () => {
    //     await saveActions([
    //       { item, account: member, createdAt },
    //       { item, account: member, createdAt },
    //       { item, account: member, createdAt },
    //       { item, account: member, createdAt },
    //     ]);
    //     const result = await actionRepository.getAggregationForItem(db, item.path);
    //     expect(result).toEqual([{ actionCount: '0' }]);
    //   });
    //   it('returns count for view only', async () => {
    //     const view = Context.Library;
    //     const actions = await saveActions([
    //       { item, account: member, view, createdAt },
    //       { item, account: member, view, createdAt },
    //     ]);
    //     // noise
    //     await saveActions([
    //       { item, account: member, view: Context.Builder },
    //       { item, account: member, view: Context.Builder },
    //     ]);
    //     const result = await actionRepository.getAggregationForItem(db, item.path, { view });
    //     expect(result).toEqual([{ actionCount: actions.length.toString() }]);
    //   });
    //   it('returns nothing for type only', async () => {
    //     const type = 'type';
    //     await saveActions([
    //       { item, account: member, type, createdAt },
    //       { item, account: member, type, createdAt },
    //     ]);
    //     // noise
    //     await saveActions([
    //       { item, account: member, type: 'type1' },
    //       { item, account: member, type: 'type1' },
    //     ]);
    //     const result = await actionRepository.getAggregationForItem(db, item.path, { types: [type] });
    //     expect(result).toEqual([{ actionCount: '0' }]);
    //   });
    //   it('returns count for type and view', async () => {
    //     const view = Context.Library;
    //     const type = 'type';
    //     const actions = await saveActions([
    //       { item, account: member, type, view, createdAt },
    //       { item, account: member, type, view, createdAt },
    //     ]);
    //     // noise
    //     await saveActions([
    //       { item, account: member, type: 'type1', view: Context.Builder },
    //       { item, account: member, type: 'type1', view: Context.Builder },
    //     ]);
    //     const result = await actionRepository.getAggregationForItem(db, item.path, {
    //       view,
    //       types: [type],
    //     });
    //     expect(result).toEqual([{ actionCount: actions.length.toString() }]);
    //   });
    //   it('returns action count does not take into account sample size', async () => {
    //     const view = Context.Library;
    //     const sampleSize = 5;
    //     await saveActions(ActionArrayFrom(sampleSize, { item, account: member, view, createdAt }));
    //     // noise
    //     await saveActions([
    //       { item, account: member, view, createdAt },
    //       { item, account: member, view, createdAt },
    //     ]);
    //     const result = await actionRepository.getAggregationForItem(db, item.path, {
    //       view,
    //       sampleSize,
    //     });
    //     expect(result).toEqual([{ actionCount: '7' }]);
    //   });
    //   describe('countGroupBy', () => {
    //     it('returns action count with countGroupBy ActionType and User', async () => {
    //       const view = Context.Library;
    //       const type = 'type';
    //       const sampleSize = 5;
    //       const bob = await saveMember();
    //       const countGroupBy = [CountGroupBy.ActionType, CountGroupBy.User];
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           account: member,
    //           view,
    //           type,
    //           createdAt,
    //         }),
    //         { item, account: bob, view, type: 'type1', createdAt },
    //         { item, account: bob, view, type: 'type2', createdAt },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         { view, sampleSize },
    //         countGroupBy,
    //       );
    //       expect(result).toEqual([
    //         {
    //           actionCount: sampleSize.toString(),
    //           actionType: type,
    //           user: member.id,
    //         },
    //         { actionCount: '1', actionType: 'type1', user: bob.id },
    //         { actionCount: '1', actionType: 'type2', user: bob.id },
    //       ]);
    //     });
    //     it('returns action count with countGroupBy ActionLocation', async () => {
    //       const view = Context.Library;
    //       const sampleSize = 5;
    //       const countGroupBy = [CountGroupBy.ActionLocation];
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           view,
    //           account: member,
    //           geolocation: { country: 'switzerland' },
    //           createdAt,
    //         }),
    //         {
    //           item,
    //           view,
    //           account: member,
    //           geolocation: { country: 'france' },
    //           createdAt,
    //         },
    //         {
    //           item,
    //           view,
    //           account: member,
    //           geolocation: { country: 'france' },
    //           createdAt,
    //         },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         { view },
    //         countGroupBy,
    //       );
    //       expect(result).toMatchObject([
    //         {
    //           actionCount: '2',
    //           actionLocation: JSON.stringify({ country: 'france' }),
    //         },
    //         {
    //           actionCount: sampleSize.toString(),
    //           actionLocation: JSON.stringify({ country: 'switzerland' }),
    //         },
    //       ]);
    //     });
    //     it('returns action count with countGroupBy CreatedDay', async () => {
    //       const view = Context.Library;
    //       const sampleSize = 5;
    //       const countGroupBy = [CountGroupBy.CreatedDay];
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           view,
    //           account: member,
    //           createdAt: '2000-12-17T03:24:00',
    //         }),
    //         {
    //           item,
    //           view,
    //           account: member,
    //           createdAt: '2000-12-18T03:24:00',
    //         },
    //         {
    //           item,
    //           view,
    //           account: member,
    //           createdAt: '2000-12-19T03:24:00',
    //         },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         {
    //           view,
    //           startDate: '2000-12-16T03:24:00',
    //           endDate: '2000-12-20T03:24:00',
    //         },
    //         countGroupBy,
    //       );
    //       expect(result).toMatchObject([
    //         {
    //           actionCount: sampleSize.toString(),
    //           createdDay: new Date('2000-12-17T00:00:00'),
    //         },
    //         { actionCount: '1', createdDay: new Date('2000-12-18T00:00:00') },
    //         { actionCount: '1', createdDay: new Date('2000-12-19T00:00:00') },
    //       ]);
    //     });
    //     it('returns action count with countGroupBy CreatedDayOfWeek', async () => {
    //       const view = Context.Library;
    //       const sampleSize = 5;
    //       const countGroupBy = [CountGroupBy.CreatedDayOfWeek];
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           view,
    //           account: member,
    //           createdAt: '2000-12-17T03:24:00',
    //         }),
    //         {
    //           item,
    //           view,
    //           account: member,
    //           createdAt: '2000-12-18T03:24:00',
    //         },
    //         {
    //           item,
    //           view,
    //           account: member,
    //           createdAt: '2000-12-19T03:24:00',
    //         },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         {
    //           view,
    //           startDate: '2000-12-16T03:24:00',
    //           endDate: '2000-12-20T03:24:00',
    //         },
    //         countGroupBy,
    //       );
    //       expect(result).toMatchObject([
    //         {
    //           actionCount: sampleSize.toString(),
    //           createdDayOfWeek: '0',
    //         },
    //         { actionCount: '1', createdDayOfWeek: '1' },
    //         { actionCount: '1', createdDayOfWeek: '2' },
    //       ]);
    //     });
    //     it('returns action count with countGroupBy CreatedTimeOfDay', async () => {
    //       const view = Context.Library;
    //       const sampleSize = 5;
    //       const countGroupBy = [CountGroupBy.CreatedTimeOfDay];
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           view,
    //           account: member,
    //           createdAt: '2000-12-17T03:24:00',
    //         }),
    //         {
    //           item,
    //           view,
    //           account: member,
    //           createdAt: '2000-12-18T13:24:00',
    //         },
    //         {
    //           item,
    //           view,
    //           account: member,
    //           createdAt: '2000-12-19T23:24:00',
    //         },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         {
    //           view,
    //           startDate: '2000-12-16T03:24:00',
    //           endDate: '2000-12-20T03:24:00',
    //         },
    //         countGroupBy,
    //       );
    //       expect(result).toMatchObject([
    //         {
    //           actionCount: sampleSize.toString(),
    //           createdTimeOfDay: '3',
    //         },
    //         { actionCount: '1', createdTimeOfDay: '13' },
    //         { actionCount: '1', createdTimeOfDay: '23' },
    //       ]);
    //     });
    //     it('returns action count with countGroupBy ItemId', async () => {
    //       const child1 = await testUtils.saveItem({
    //         actor: member,
    //         parentItem: item,
    //       });
    //       const child2 = await testUtils.saveItem({
    //         actor: member,
    //         parentItem: item,
    //       });
    //       const view = Context.Library;
    //       const sampleSize = 5;
    //       const countGroupBy = [CountGroupBy.ItemId];
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           view,
    //           account: member,
    //           createdAt,
    //         }),
    //         {
    //           item: child1 as unknown as DiscriminatedItem,
    //           view,
    //           account: member,
    //           createdAt,
    //         },
    //         {
    //           item: child2 as unknown as DiscriminatedItem,
    //           view,
    //           account: member,
    //           createdAt,
    //         },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         { view },
    //         countGroupBy,
    //       );
    //       expect(result).toContainEqual({
    //         actionCount: sampleSize.toString(),
    //         itemId: item.id,
    //       });
    //       expect(result).toContainEqual({ actionCount: '1', itemId: child1.id });
    //       expect(result).toContainEqual({ actionCount: '1', itemId: child2.id });
    //     });
    //     it('returns action count with countGroupBy User', async () => {
    //       const view = Context.Library;
    //       const type = 'type';
    //       const sampleSize = 5;
    //       const bob = await saveMember();
    //       const countGroupBy = [CountGroupBy.User];
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           account: member,
    //           view,
    //           type,
    //           createdAt,
    //         }),
    //         { item, account: bob, view, type: 'type1', createdAt },
    //         { item, account: bob, view, type: 'type2', createdAt },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         { view, sampleSize },
    //         countGroupBy,
    //       );
    //       expect(result).toContainEqual({
    //         actionCount: sampleSize.toString(),
    //         user: member.id,
    //       });
    //       expect(result).toContainEqual({ actionCount: '2', user: bob.id });
    //     });
    //   });
    //   describe('aggregateFunction & aggregateMetric', () => {
    //     it('returns aggregate result with aggregateFunction for action type', async () => {
    //       const view = Context.Library;
    //       const sampleSize = 5;
    //       const countGroupBy = [CountGroupBy.ActionType];
    //       const aggregateFunction = AggregateFunction.Count;
    //       const aggregateMetric = AggregateMetric.ActionType;
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           account: member,
    //           view,
    //           type: 'type',
    //           createdAt,
    //         }),
    //         { item, account: member, view, type: 'type1', createdAt },
    //         { item, account: member, view, type: 'type2', createdAt },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         {
    //           view,
    //         },
    //         countGroupBy,
    //         {
    //           aggregateFunction,
    //           aggregateMetric,
    //         },
    //       );
    //       expect(result).toContainEqual({ aggregateResult: '3' });
    //     });
    //     it('returns aggregate result with aggregateFunction for action created day', async () => {
    //       const view = Context.Library;
    //       const sampleSize = 5;
    //       const countGroupBy = [CountGroupBy.CreatedDay];
    //       const aggregateFunction = AggregateFunction.Count;
    //       const aggregateMetric = AggregateMetric.CreatedDay;
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           account: member,
    //           view,
    //           type: 'type',
    //           createdAt,
    //         }),
    //         {
    //           item,
    //           account: member,
    //           view,
    //           type: 'type1',
    //           createdAt: formatISO(addDays(new Date(), -2)),
    //         },
    //         {
    //           item,
    //           account: member,
    //           view,
    //           type: 'type2',
    //           createdAt: formatISO(addDays(new Date(), -3)),
    //         },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         { view },
    //         countGroupBy,
    //         {
    //           aggregateFunction,
    //           aggregateMetric,
    //         },
    //       );
    //       expect(result).toContainEqual({ aggregateResult: '3' });
    //     });
    //     it('returns average number of actions per user', async () => {
    //       const view = Context.Library;
    //       const sampleSize = 5;
    //       const bob = await saveMember();
    //       const countGroupBy = [CountGroupBy.User];
    //       const aggregateFunction = AggregateFunction.Avg;
    //       const aggregateMetric = AggregateMetric.ActionCount;
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           account: member,
    //           view,
    //           type: 'type',
    //           createdAt,
    //         }),
    //         { item, account: bob, view, type: 'type1', createdAt },
    //         { item, account: bob, view, type: 'type2', createdAt },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         { view },
    //         countGroupBy,
    //         {
    //           aggregateFunction,
    //           aggregateMetric,
    //         },
    //       );
    //       expect(result).toHaveLength(1);
    //       // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //       expect(parseFloat((result[0] as any).aggregateResult)).toEqual(3.5);
    //     });
    //   });
    //   describe('aggregateBy', () => {
    //     it('returns total actions per action type', async () => {
    //       const view = Context.Library;
    //       const sampleSize = 5;
    //       const bob = await saveMember();
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           account: member,
    //           view,
    //           type: 'type',
    //           createdAt,
    //         }),
    //         { item, account: member, view, type: 'type1', createdAt },
    //         { item, account: bob, view, type: 'type1', createdAt },
    //         { item, account: bob, view, type: 'type1', createdAt },
    //         { item, account: bob, view, type: 'type2', createdAt },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         { view },
    //         [CountGroupBy.User, CountGroupBy.ActionType],
    //         {
    //           aggregateFunction: AggregateFunction.Sum,
    //           aggregateMetric: AggregateMetric.ActionCount,
    //           aggregateBy: [AggregateBy.ActionType],
    //         },
    //       );
    //       expect(result).toContainEqual({
    //         actionType: 'type',
    //         aggregateResult: '5',
    //       });
    //       expect(result).toContainEqual({
    //         actionType: 'type1',
    //         aggregateResult: '3',
    //       });
    //       expect(result).toContainEqual({
    //         actionType: 'type2',
    //         aggregateResult: '1',
    //       });
    //     });
    //     it('returns total actions per action type', async () => {
    //       const view = Context.Library;
    //       const sampleSize = 5;
    //       const bob = await saveMember();
    //       await saveActions([
    //         ...ActionArrayFrom(sampleSize, {
    //           item,
    //           account: member,
    //           view,
    //           type: 'type',
    //           createdAt: '2000-12-19T03:24:00',
    //         }),
    //         {
    //           item,
    //           account: member,
    //           view,
    //           type: 'type1',
    //           createdAt: '2000-12-18T03:24:00',
    //         },
    //         {
    //           item,
    //           account: bob,
    //           view,
    //           type: 'type1',
    //           createdAt: '2000-12-17T03:24:00',
    //         },
    //         {
    //           item,
    //           account: bob,
    //           view,
    //           type: 'type1',
    //           createdAt: '2000-12-16T03:24:00',
    //         },
    //         {
    //           item,
    //           account: bob,
    //           view,
    //           type: 'type2',
    //           createdAt: '2000-12-15T03:24:00',
    //         },
    //       ]);
    //       const result = await actionRepository.getAggregationForItem(
    //         db,
    //         item.path,
    //         {
    //           view,
    //           startDate: '2000-12-14T03:24:00',
    //           endDate: '2000-12-20T03:24:00',
    //         },
    //         [CountGroupBy.User, CountGroupBy.CreatedDay],
    //         {
    //           aggregateFunction: AggregateFunction.Avg,
    //           aggregateMetric: AggregateMetric.ActionCount,
    //           aggregateBy: [AggregateBy.CreatedDay],
    //         },
    //       );
    //       expect(result).toHaveLength(5);
    //       expect(result).toContainEqual({
    //         aggregateResult: '1.00000000000000000000',
    //         createdDay: new Date('2000-12-15T00:00:00.000Z'),
    //       });
    //       expect(result).toContainEqual({
    //         aggregateResult: '1.00000000000000000000',
    //         createdDay: new Date('2000-12-16T00:00:00.000Z'),
    //       });
    //       expect(result).toContainEqual({
    //         aggregateResult: '1.00000000000000000000',
    //         createdDay: new Date('2000-12-17T00:00:00.000Z'),
    //       });
    //       expect(result).toContainEqual({
    //         aggregateResult: '1.00000000000000000000',
    //         createdDay: new Date('2000-12-18T00:00:00.000Z'),
    //       });
    //       expect(result).toContainEqual({
    //         aggregateResult: '5.0000000000000000',
    //         createdDay: new Date('2000-12-19T00:00:00.000Z'),
    //       });
    //     });
    //   });
  });
});
