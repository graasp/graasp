import { addDays, formatISO } from 'date-fns';

import {
  ActionFactory,
  ActionTriggers,
  AggregateBy,
  AggregateFunction,
  AggregateMetric,
  Context,
  CountGroupBy,
  DiscriminatedItem,
  Action as GraaspAction,
} from '@graasp/sdk';

import { client, db } from '../../drizzle/db';
import { Account, Item } from '../../drizzle/schema';
import { ItemTestUtils } from '../item/test/fixtures/items';
import { getPreviousMonthFromNow } from '../member/plugins/action/service';
import { saveMember } from '../member/test/fixtures/members';
import { ActionRepository } from './action.repository';
import { DEFAULT_ACTIONS_SAMPLE_SIZE } from './constants';
import { expectActions, getMemberActions, saveActions } from './test/fixtures/actions';

const actionRepository = new ActionRepository();

const testUtils = new ItemTestUtils();
const createdAt = formatISO(addDays(new Date(), -1));

function ActionArrayFrom(length: number, actionTemplate: Partial<GraaspAction>) {
  return Array.from({ length }, () => actionTemplate);
}
describe('Action Repository', () => {
  let actor: Account;
  let member: Account;
  let item: Item;

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    actor = await saveMember();
    item = await testUtils.saveItem({ actor });
    member = await saveMember();
  });

  describe('postMany', () => {
    it('save many actions', async () => {
      const actions = [ActionFactory(), ActionFactory(), ActionFactory(), ActionFactory()]
        // HACK: transform the extra to a string since the schema expects it to be a string
        .map((a) => ({
          ...a,
          extra: JSON.stringify(a.extra) as string,
          // HACK: this is because the type in the db is infered as a string and geoiplite could not be imported in the sdk
          geolocation: a.geolocation as string,
        }));

      const actionsBefore = await db.query.actions.findMany();
      await actionRepository.postMany(db, actions);
      const actionsAfter = await db.query.actions.findMany();

      expect(actionsAfter.length - actionsBefore.length).toEqual(actions.length);
    });
  });

  describe('deleteAllForMember', () => {
    it('delete all actions for member', async () => {
      const member = await saveMember();
      const bob = await saveMember();
      await saveActions([
        { account: member },
        { account: member },
        { account: member },
        { account: member },
        // noise
        { account: bob },
      ]);

      await actionRepository.deleteAllForAccount(db, member.id);

      expect(await getMemberActions(db, member.id)).toHaveLength(0);
      // contains at least bob's actions
      expect(await db.query.actions.findMany()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getForMember', () => {
    it('get actions that require permissions for member within the last month', async () => {
      const item = await testUtils.saveItem({ actor: member });

      await saveActions([
        {
          account: member,
          createdAt: new Date().toISOString(),
          type: ActionTriggers.Update,
          item: item as unknown as DiscriminatedItem,
        },
        {
          account: member,
          createdAt: new Date().toISOString(),
          type: ActionTriggers.CollectionView,
        },
        {
          account: member,
          createdAt: new Date('1999-07-08').toISOString(),
          type: ActionTriggers.Update,
        },
        { account: member, createdAt: new Date().toISOString(), type: ActionTriggers.ItemLike },
      ]);

      const result = await actionRepository.getAccountActions(db, member.id, {
        startDate: getPreviousMonthFromNow(),
        endDate: new Date(),
      });

      expect(result.length).toEqual(3);
    });
  });

  describe('getForItem', () => {
    it('get all actions for item', async () => {
      const actions = await saveActions([
        { item, account: member, createdAt },
        { item, account: member, createdAt },
      ]);

      // noise
      await saveActions([{ account: member }, { account: member }]);

      const result = await actionRepository.getForItem(db, item.path);

      expectActions(result, actions);
    });

    it('get all actions for item for max sampleSize', async () => {
      const sampleSize = 3;
      const actions = await saveActions(
        ActionArrayFrom(sampleSize, { item, account: member, createdAt }),
      );

      // noise
      await saveActions([
        { item, account: member, createdAt: new Date('2000-12-17T03:24:00').toISOString() },
        { item, account: member, createdAt: new Date('2000-12-17T03:24:00').toISOString() },
        { item, account: member, createdAt: new Date('2000-12-17T03:24:00').toISOString() },
        { account: member },
        { account: member },
      ]);

      const result = await actionRepository.getForItem(db, item.path, { sampleSize });

      expectActions(result, actions.slice(0, sampleSize));
    });

    it('get all actions for item for default sampleSize', async () => {
      const actions = await saveActions(
        ActionArrayFrom(DEFAULT_ACTIONS_SAMPLE_SIZE, { item, account: member, createdAt }),
      );

      // noise
      await saveActions([
        { item, account: member, createdAt: new Date('2000-12-17T03:24:00').toISOString() },
        { item, account: member, createdAt: new Date('2000-12-17T03:24:00').toISOString() },
        { item, account: member, createdAt: new Date('2000-12-17T03:24:00').toISOString() },
        { account: member },
        { account: member },
      ]);

      const result = await actionRepository.getForItem(db, item.path);

      expect(result).toHaveLength(DEFAULT_ACTIONS_SAMPLE_SIZE);
      expectActions(result, actions);
    });

    it('get all actions for item for view', async () => {
      const sampleSize = 5;
      const view = Context.Builder;
      const actions = await saveActions(
        ActionArrayFrom(sampleSize, { item, account: member, view, createdAt }),
      );

      // noise
      await saveActions([
        {
          item,
          account: member,
          view: Context.Player,
          createdAt: new Date('2000-12-17T03:24:00').toISOString(),
        },
        {
          item,
          account: member,
          view: Context.Player,
          createdAt: new Date('2000-12-17T03:24:00').toISOString(),
        },
        {
          item,
          account: member,
          view: Context.Player,
          createdAt: new Date('2000-12-17T03:24:00').toISOString(),
        },
        { view: Context.Player, account: member },
        { view: Context.Player, account: member },
      ]);

      const result = await actionRepository.getForItem(db, item.path, { view });

      expectActions(result, actions);
    });

    it('get all actions for item for member Id', async () => {
      const bob = await saveMember();
      const sampleSize = 5;
      const actions = await saveActions(
        ActionArrayFrom(sampleSize, { item, account: member, createdAt }),
      );

      // noise
      await saveActions([{ account: bob }, { account: bob }]);

      const result = await actionRepository.getForItem(db, item.path, { accountId: member.id });

      expectActions(result, actions);
    });

    it('get all actions for item and its descendants', async () => {
      const child = await testUtils.saveItem({ actor: member, parentItem: item });

      const actions = await saveActions([
        { item, account: member, createdAt },
        { item, account: member, createdAt },
        { item: child, account: member, createdAt },
        { item: child, account: member, createdAt },
        { item: child, account: member, createdAt },
      ]);

      // noise
      await saveActions([{ account: member }, { account: member }]);

      const result = await actionRepository.getForItem(db, item.path, { accountId: member.id });

      expectActions(result, actions);
    });
  });

  describe('getAggregationForItem', () => {
    it('returns nothing for no parameter', async () => {
      await saveActions([
        { item, account: member, createdAt },
        { item, account: member, createdAt },
        { item, account: member, createdAt },
        { item, account: member, createdAt },
      ]);

      const result = await actionRepository.getAggregationForItem(db, item.path);
      expect(result).toEqual([{ actionCount: '0' }]);
    });
    it('returns count for view only', async () => {
      const view = Context.Library;
      const actions = await saveActions([
        { item, account: member, view, createdAt },
        { item, account: member, view, createdAt },
      ]);

      // noise
      await saveActions([
        { item, account: member, view: Context.Builder },
        { item, account: member, view: Context.Builder },
      ]);

      const result = await actionRepository.getAggregationForItem(db, item.path, { view });
      expect(result).toEqual([{ actionCount: actions.length.toString() }]);
    });

    it('returns nothing for type only', async () => {
      const type = 'type';
      await saveActions([
        { item, account: member, type, createdAt },
        { item, account: member, type, createdAt },
      ]);

      // noise
      await saveActions([
        { item, account: member, type: 'type1' },
        { item, account: member, type: 'type1' },
      ]);

      const result = await actionRepository.getAggregationForItem(db, item.path, { types: [type] });
      expect(result).toEqual([{ actionCount: '0' }]);
    });

    it('returns count for type and view', async () => {
      const view = Context.Library;
      const type = 'type';
      const actions = await saveActions([
        { item, account: member, type, view, createdAt },
        { item, account: member, type, view, createdAt },
      ]);

      // noise
      await saveActions([
        { item, account: member, type: 'type1', view: Context.Builder },
        { item, account: member, type: 'type1', view: Context.Builder },
      ]);

      const result = await actionRepository.getAggregationForItem(db, item.path, {
        view,
        types: [type],
      });
      expect(result).toEqual([{ actionCount: actions.length.toString() }]);
    });

    it('returns action count does not take into account sample size', async () => {
      const view = Context.Library;
      const sampleSize = 5;
      await saveActions(ActionArrayFrom(sampleSize, { item, account: member, view, createdAt }));

      // noise
      await saveActions([
        { item, account: member, view, createdAt },
        { item, account: member, view, createdAt },
      ]);

      const r = new ActionRepository();

      const result = await actionRepository.getAggregationForItem(db, item.path, {
        view,
        sampleSize,
      });
      expect(result).toEqual([{ actionCount: '7' }]);
    });

    describe('countGroupBy', () => {
      it('returns action count with countGroupBy ActionType and User', async () => {
        const view = Context.Library;
        const type = 'type';
        const sampleSize = 5;
        const bob = await saveMember();
        const countGroupBy = [CountGroupBy.ActionType, CountGroupBy.User];
        await saveActions([
          ...ActionArrayFrom(sampleSize, { item, account: member, view, type, createdAt }),
          { item, account: bob, view, type: 'type1', createdAt },
          { item, account: bob, view, type: 'type2', createdAt },
        ]);

        const result = await actionRepository.getAggregationForItem(
          db,
          item.path,
          { view, sampleSize },
          countGroupBy,
        );
        expect(result).toEqual([
          { actionCount: sampleSize.toString(), actionType: type, user: member.id },
          { actionCount: '1', actionType: 'type1', user: bob.id },
          { actionCount: '1', actionType: 'type2', user: bob.id },
        ]);
      });

      it('returns action count with countGroupBy ActionLocation', async () => {
        const view = Context.Library;
        const sampleSize = 5;
        const countGroupBy = [CountGroupBy.ActionLocation];
        await saveActions([
          ...ActionArrayFrom(sampleSize, {
            item,
            view,
            account: member,
            geolocation: { country: 'switzerland' },
            createdAt,
          }),
          {
            item,
            view,
            account: member,
            geolocation: { country: 'france' },
            createdAt,
          },
          {
            item,
            view,
            account: member,
            geolocation: { country: 'france' },
            createdAt,
          },
        ]);

        const result = await actionRepository.getAggregationForItem(
          db,
          item.path,
          { view },
          countGroupBy,
        );

        expect(result).toMatchObject([
          { actionCount: '2', actionLocation: JSON.stringify({ country: 'france' }) },
          {
            actionCount: sampleSize.toString(),
            actionLocation: JSON.stringify({ country: 'switzerland' }),
          },
        ]);
      });

      it('returns action count with countGroupBy CreatedDay', async () => {
        const view = Context.Library;
        const sampleSize = 5;
        const countGroupBy = [CountGroupBy.CreatedDay];
        await saveActions([
          ...ActionArrayFrom(sampleSize, {
            item,
            view,
            account: member,
            createdAt: '2000-12-17T03:24:00',
          }),
          {
            item,
            view,
            account: member,
            createdAt: '2000-12-18T03:24:00',
          },
          {
            item,
            view,
            account: member,
            createdAt: '2000-12-19T03:24:00',
          },
        ]);

        const result = await actionRepository.getAggregationForItem(
          db,
          item.path,
          { view, startDate: '2000-12-16T03:24:00', endDate: '2000-12-20T03:24:00' },
          countGroupBy,
        );
        expect(result).toMatchObject([
          {
            actionCount: sampleSize.toString(),
            createdDay: new Date('2000-12-17T00:00:00'),
          },
          { actionCount: '1', createdDay: new Date('2000-12-18T00:00:00') },
          { actionCount: '1', createdDay: new Date('2000-12-19T00:00:00') },
        ]);
      });

      it('returns action count with countGroupBy CreatedDayOfWeek', async () => {
        const view = Context.Library;
        const sampleSize = 5;
        const countGroupBy = [CountGroupBy.CreatedDayOfWeek];
        await saveActions([
          ...ActionArrayFrom(sampleSize, {
            item,
            view,
            account: member,
            createdAt: '2000-12-17T03:24:00',
          }),
          {
            item,
            view,
            account: member,
            createdAt: '2000-12-18T03:24:00',
          },
          {
            item,
            view,
            account: member,
            createdAt: '2000-12-19T03:24:00',
          },
        ]);

        const result = await actionRepository.getAggregationForItem(
          db,
          item.path,
          { view, startDate: '2000-12-16T03:24:00', endDate: '2000-12-20T03:24:00' },
          countGroupBy,
        );
        expect(result).toMatchObject([
          {
            actionCount: sampleSize.toString(),
            createdDayOfWeek: '0',
          },
          { actionCount: '1', createdDayOfWeek: '1' },
          { actionCount: '1', createdDayOfWeek: '2' },
        ]);
      });

      it('returns action count with countGroupBy CreatedTimeOfDay', async () => {
        const view = Context.Library;
        const sampleSize = 5;
        const countGroupBy = [CountGroupBy.CreatedTimeOfDay];
        await saveActions([
          ...ActionArrayFrom(sampleSize, {
            item,
            view,
            account: member,
            createdAt: '2000-12-17T03:24:00',
          }),
          {
            item,
            view,
            account: member,
            createdAt: '2000-12-18T13:24:00',
          },
          {
            item,
            view,
            account: member,
            createdAt: '2000-12-19T23:24:00',
          },
        ]);

        const r = new ActionRepository();

        const result = await r.getAggregationForItem(
          db,
          item.path,
          { view, startDate: '2000-12-16T03:24:00', endDate: '2000-12-20T03:24:00' },
          countGroupBy,
        );
        expect(result).toMatchObject([
          {
            actionCount: sampleSize.toString(),
            createdTimeOfDay: '3',
          },
          { actionCount: '1', createdTimeOfDay: '13' },
          { actionCount: '1', createdTimeOfDay: '23' },
        ]);
      });

      it('returns action count with countGroupBy ItemId', async () => {
        const child1 = await testUtils.saveItem({ actor: member, parentItem: item });
        const child2 = await testUtils.saveItem({ actor: member, parentItem: item });
        const view = Context.Library;
        const sampleSize = 5;
        const countGroupBy = [CountGroupBy.ItemId];
        await saveActions([
          ...ActionArrayFrom(sampleSize, {
            item,
            view,
            account: member,
            createdAt,
          }),
          {
            item: child1 as unknown as DiscriminatedItem,
            view,
            account: member,
            createdAt,
          },
          {
            item: child2 as unknown as DiscriminatedItem,
            view,
            account: member,
            createdAt,
          },
        ]);

        const result = await actionRepository.getAggregationForItem(
          db,
          item.path,
          { view },
          countGroupBy,
        );
        expect(result).toContainEqual({
          actionCount: sampleSize.toString(),
          itemId: item.id,
        });
        expect(result).toContainEqual({ actionCount: '1', itemId: child1.id });
        expect(result).toContainEqual({ actionCount: '1', itemId: child2.id });
      });

      it('returns action count with countGroupBy User', async () => {
        const view = Context.Library;
        const type = 'type';
        const sampleSize = 5;
        const bob = await saveMember();
        const countGroupBy = [CountGroupBy.User];
        await saveActions([
          ...ActionArrayFrom(sampleSize, { item, account: member, view, type, createdAt }),
          { item, account: bob, view, type: 'type1', createdAt },
          { item, account: bob, view, type: 'type2', createdAt },
        ]);

        const result = await actionRepository.getAggregationForItem(
          db,
          item.path,
          { view, sampleSize },
          countGroupBy,
        );
        expect(result).toContainEqual({ actionCount: sampleSize.toString(), user: member.id });
        expect(result).toContainEqual({ actionCount: '2', user: bob.id });
      });
    });
    describe('aggregateFunction & aggregateMetric', () => {
      it('returns aggregate result with aggregateFunction for action type', async () => {
        const view = Context.Library;
        const sampleSize = 5;
        const countGroupBy = [CountGroupBy.ActionType];
        const aggregateFunction = AggregateFunction.Count;
        const aggregateMetric = AggregateMetric.ActionType;
        await saveActions([
          ...ActionArrayFrom(sampleSize, { item, account: member, view, type: 'type', createdAt }),
          { item, account: member, view, type: 'type1', createdAt },
          { item, account: member, view, type: 'type2', createdAt },
        ]);

        const result = await actionRepository.getAggregationForItem(
          db,
          item.path,
          {
            view,
          },
          countGroupBy,
          {
            aggregateFunction,
            aggregateMetric,
          },
        );
        expect(result).toContainEqual({ aggregateResult: '3' });
      });

      it('returns aggregate result with aggregateFunction for action created day', async () => {
        const view = Context.Library;
        const sampleSize = 5;
        const countGroupBy = [CountGroupBy.CreatedDay];
        const aggregateFunction = AggregateFunction.Count;
        const aggregateMetric = AggregateMetric.CreatedDay;
        await saveActions([
          ...ActionArrayFrom(sampleSize, {
            item,
            account: member,
            view,
            type: 'type',
            createdAt,
          }),
          {
            item,
            account: member,
            view,
            type: 'type1',
            createdAt: formatISO(addDays(new Date(), -2)),
          },
          {
            item,
            account: member,
            view,
            type: 'type2',
            createdAt: formatISO(addDays(new Date(), -3)),
          },
        ]);

        const result = await actionRepository.getAggregationForItem(
          db,
          item.path,
          { view },
          countGroupBy,
          {
            aggregateFunction,
            aggregateMetric,
          },
        );
        expect(result).toContainEqual({ aggregateResult: '3' });
      });
      it('returns average number of actions per user', async () => {
        const view = Context.Library;
        const sampleSize = 5;
        const bob = await saveMember();
        const countGroupBy = [CountGroupBy.User];
        const aggregateFunction = AggregateFunction.Avg;
        const aggregateMetric = AggregateMetric.ActionCount;
        await saveActions([
          ...ActionArrayFrom(sampleSize, { item, account: member, view, type: 'type', createdAt }),
          { item, account: bob, view, type: 'type1', createdAt },
          { item, account: bob, view, type: 'type2', createdAt },
        ]);

        const result = await actionRepository.getAggregationForItem(
          db,
          item.path,
          { view },
          countGroupBy,
          {
            aggregateFunction,
            aggregateMetric,
          },
        );
        expect(result).toHaveLength(1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(parseFloat((result[0] as any).aggregateResult)).toEqual(3.5);
      });
    });
    describe('aggregateBy', () => {
      it('returns total actions per action type', async () => {
        const view = Context.Library;
        const sampleSize = 5;
        const bob = await saveMember();
        await saveActions([
          ...ActionArrayFrom(sampleSize, { item, account: member, view, type: 'type', createdAt }),
          { item, account: member, view, type: 'type1', createdAt },
          { item, account: bob, view, type: 'type1', createdAt },
          { item, account: bob, view, type: 'type1', createdAt },
          { item, account: bob, view, type: 'type2', createdAt },
        ]);

        const result = await actionRepository.getAggregationForItem(
          db,
          item.path,
          { view },
          [CountGroupBy.User, CountGroupBy.ActionType],
          {
            aggregateFunction: AggregateFunction.Sum,
            aggregateMetric: AggregateMetric.ActionCount,
            aggregateBy: [AggregateBy.ActionType],
          },
        );

        expect(result).toContainEqual({ actionType: 'type', aggregateResult: '5' });
        expect(result).toContainEqual({ actionType: 'type1', aggregateResult: '3' });
        expect(result).toContainEqual({ actionType: 'type2', aggregateResult: '1' });
      });
      it('returns total actions per action type', async () => {
        const view = Context.Library;
        const sampleSize = 5;
        const bob = await saveMember();
        await saveActions([
          ...ActionArrayFrom(sampleSize, {
            item,
            account: member,
            view,
            type: 'type',
            createdAt: '2000-12-19T03:24:00',
          }),
          { item, account: member, view, type: 'type1', createdAt: '2000-12-18T03:24:00' },
          {
            item,
            account: bob,
            view,
            type: 'type1',
            createdAt: '2000-12-17T03:24:00',
          },
          {
            item,
            account: bob,
            view,
            type: 'type1',
            createdAt: '2000-12-16T03:24:00',
          },
          {
            item,
            account: bob,
            view,
            type: 'type2',
            createdAt: '2000-12-15T03:24:00',
          },
        ]);

        const result = await actionRepository.getAggregationForItem(
          db,
          item.path,
          { view, startDate: '2000-12-14T03:24:00', endDate: '2000-12-20T03:24:00' },
          [CountGroupBy.User, CountGroupBy.CreatedDay],
          {
            aggregateFunction: AggregateFunction.Avg,
            aggregateMetric: AggregateMetric.ActionCount,
            aggregateBy: [AggregateBy.CreatedDay],
          },
        );

        expect(result).toHaveLength(5);
        expect(result).toContainEqual({
          aggregateResult: '1.00000000000000000000',
          createdDay: new Date('2000-12-15T00:00:00.000Z'),
        });
        expect(result).toContainEqual({
          aggregateResult: '1.00000000000000000000',
          createdDay: new Date('2000-12-16T00:00:00.000Z'),
        });
        expect(result).toContainEqual({
          aggregateResult: '1.00000000000000000000',
          createdDay: new Date('2000-12-17T00:00:00.000Z'),
        });
        expect(result).toContainEqual({
          aggregateResult: '1.00000000000000000000',
          createdDay: new Date('2000-12-18T00:00:00.000Z'),
        });
        expect(result).toContainEqual({
          aggregateResult: '5.0000000000000000',
          createdDay: new Date('2000-12-19T00:00:00.000Z'),
        });
      });
    });
  });
});
