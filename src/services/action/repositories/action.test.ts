import {
  ActionFactory,
  AggregateFunction,
  AggregateMetric,
  Context,
  CountGroupBy,
  FolderItemFactory,
} from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { AppDataSource } from '../../../plugins/datasource';
import { ItemRepository } from '../../item/repository';
import { createItem, saveItem } from '../../item/test/fixtures/items';
import { saveMember } from '../../member/test/fixtures/members';
import { DEFAULT_ACTIONS_SAMPLE_SIZE } from '../constants/constants';
import { Action } from '../entities/action';
import { expectActions } from '../test/fixtures/actions';
import { ActionRepository } from './action';

// mock datasource
jest.mock('../../../plugins/datasource');

const rawRepository = AppDataSource.getRepository(Action);

describe('Action Repository', () => {
  let app;
  let actor;
  let member;
  let item;

  beforeEach(async () => {
    ({ app, actor } = await build());
    member = await saveMember();

    item = await saveItem({ actor });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    member = null;
    item = null;
    app.close();
  });

  describe('postMany', () => {
    it('save many actions', async () => {
      const actions = [
        ActionFactory({ item: null, member: null }),
        ActionFactory({ item: null, member: null }),
        ActionFactory({ item: null, member: null }),
        ActionFactory({ item: null, member: null }),
      ] as unknown as Action[];

      const r = new ActionRepository();

      await r.postMany(actions);

      expect(await rawRepository.find()).toHaveLength(actions.length);
    });
  });

  describe('deleteAllForMember', () => {
    it('delete all actions for member', async () => {
      const bob = await saveMember();
      const actions = [
        ActionFactory({ item: null, member }),
        ActionFactory({ item: null, member }),
        ActionFactory({ item: null, member }),
        ActionFactory({ item: null, member }),

        // noise
        ActionFactory({ item: null, member: bob }),
      ] as unknown as Action[];
      await rawRepository.save(actions);

      const r = new ActionRepository();

      await r.deleteAllForMember(member.id);

      expect(await rawRepository.find()).toHaveLength(1);
    });
  });

  describe('getForItem', () => {
    it('get all actions for item', async () => {
      const actions = [
        ActionFactory({ item, member }),
        ActionFactory({ item, member }),
      ] as unknown as Action[];
      await rawRepository.save(actions);

      // noise
      await rawRepository.save([
        ActionFactory({ item: null, member }),
        ActionFactory({ item: null, member }),
      ] as unknown as Action[]);

      const r = new ActionRepository();

      const result = await r.getForItem(item.path);

      expectActions(result, actions);
    });

    it('get all actions for item for max sampleSize', async () => {
      const sampleSize = 3;
      const actions = Array.from({ length: sampleSize }, () =>
        ActionFactory({ item, member }),
      ) as unknown as Action[];
      await rawRepository.save(actions);

      // noise
      await rawRepository.save([
        ActionFactory({ item, member, createdAt: new Date('2000-12-17T03:24:00').toISOString() }),
        ActionFactory({ item, member, createdAt: new Date('2000-12-17T03:24:00').toISOString() }),
        ActionFactory({ item, member, createdAt: new Date('2000-12-17T03:24:00').toISOString() }),
        ActionFactory({ item: null, member }),
        ActionFactory({ item: null, member }),
      ] as unknown as Action[]);

      const r = new ActionRepository();
      const result = await r.getForItem(item.path, { sampleSize });

      expectActions(result, actions.slice(0, sampleSize));
    });

    it('get all actions for item for default sampleSize', async () => {
      const actions = Array.from({ length: DEFAULT_ACTIONS_SAMPLE_SIZE }, () =>
        ActionFactory({ item, member }),
      ) as unknown as Action[];
      await rawRepository.save(actions);

      // noise
      await rawRepository.save([
        ActionFactory({ item, member, createdAt: new Date('2000-12-17T03:24:00').toISOString() }),
        ActionFactory({ item, member, createdAt: new Date('2000-12-17T03:24:00').toISOString() }),
        ActionFactory({ item, member, createdAt: new Date('2000-12-17T03:24:00').toISOString() }),
        ActionFactory({ item: null, member }),
        ActionFactory({ item: null, member }),
      ] as unknown as Action[]);

      const r = new ActionRepository();
      const result = await r.getForItem(item.path);

      expect(result).toHaveLength(DEFAULT_ACTIONS_SAMPLE_SIZE);
      expectActions(result, actions);
    });

    it('get all actions for item for view', async () => {
      const sampleSize = 5;
      const view = Context.Builder;
      const actions = Array.from({ length: sampleSize }, () =>
        ActionFactory({ item, member, view }),
      ) as unknown as Action[];
      await rawRepository.save(actions);

      // noise
      await rawRepository.save([
        ActionFactory({
          item,
          member,
          view: Context.Player,
          createdAt: new Date('2000-12-17T03:24:00').toISOString(),
        }),
        ActionFactory({
          item,
          member,
          view: Context.Player,
          createdAt: new Date('2000-12-17T03:24:00').toISOString(),
        }),
        ActionFactory({
          item,
          member,
          view: Context.Player,
          createdAt: new Date('2000-12-17T03:24:00').toISOString(),
        }),
        ActionFactory({ item: null, view: Context.Player, member }),
        ActionFactory({ item: null, view: Context.Player, member }),
      ] as unknown as Action[]);

      const r = new ActionRepository();
      const result = await r.getForItem(item.path, { view });

      expectActions(result, actions);
    });

    it('get all actions for item for member Id', async () => {
      const bob = await saveMember();
      const sampleSize = 5;
      const actions = Array.from({ length: sampleSize }, () =>
        ActionFactory({ item, member }),
      ) as unknown as Action[];
      await rawRepository.save(actions);

      // noise
      await rawRepository.save([
        ActionFactory({ item: null, member: bob }),
        ActionFactory({ item: null, member: bob }),
      ] as unknown as Action[]);

      const r = new ActionRepository();
      const result = await r.getForItem(item.path, { memberId: member.id });

      expectActions(result, actions);
    });

    it('get all actions for item and its descendants', async () => {
      const child = await saveItem({ actor: member, parentItem: item });

      const actions = [
        ActionFactory({ item, member }),
        ActionFactory({ item, member }),
        ActionFactory({ item: child as any, member }),
        ActionFactory({ item: child as any, member }),
        ActionFactory({ item: child as any, member }),
      ] as unknown as Action[];
      await rawRepository.save(actions);

      // noise
      await rawRepository.save([
        ActionFactory({ item: null, member }),
        ActionFactory({ item: null, member }),
      ] as unknown as Action[]);

      const r = new ActionRepository();
      const result = await r.getForItem(item.path, { memberId: member.id });

      expectActions(result, actions);
    });
  });

  describe('getAggregationForItem', () => {
    it('returns nothing for no parameter', async () => {
      const actions = [
        ActionFactory({ item, member }),
        ActionFactory({ item, member }),
        ActionFactory({ item, member }),
        ActionFactory({ item, member }),
      ] as unknown as Action[];
      await rawRepository.save(actions);

      const r = new ActionRepository();

      const result = await r.getAggregationForItem(item.path);
      expect(result).toEqual([{ actionCount: '0' }]);
    });
    it('returns count for view only', async () => {
      const view = Context.Library;
      const actions = [
        ActionFactory({ item, member, view }),
        ActionFactory({ item, member, view }),
      ] as unknown as Action[];
      await rawRepository.save(actions);

      // noise
      await rawRepository.save([
        ActionFactory({ item, member, view: Context.Builder }),
        ActionFactory({ item, member, view: Context.Builder }),
      ] as unknown as Action[]);

      const r = new ActionRepository();

      const result = await r.getAggregationForItem(item.path, { view });
      expect(result).toEqual([{ actionCount: actions.length.toString() }]);
    });

    it('returns nothing for type only', async () => {
      const type = 'type';
      const actions = [
        ActionFactory({ item, member, type }),
        ActionFactory({ item, member, type }),
      ] as unknown as Action[];
      await rawRepository.save(actions);

      // noise
      await rawRepository.save([
        ActionFactory({ item, member, type: 'type1' }),
        ActionFactory({ item, member, type: 'type1' }),
      ] as unknown as Action[]);

      const r = new ActionRepository();

      const result = await r.getAggregationForItem(item.path, { types: [type] });
      expect(result).toEqual([{ actionCount: '0' }]);
    });

    it('returns count for type and view', async () => {
      const view = Context.Library;
      const type = 'type';
      const actions = [
        ActionFactory({ item, member, type, view }),
        ActionFactory({ item, member, type, view }),
      ] as unknown as Action[];
      await rawRepository.save(actions);

      // noise
      await rawRepository.save([
        ActionFactory({ item, member, type: 'type1', view: Context.Builder }),
        ActionFactory({ item, member, type: 'type1', view: Context.Builder }),
      ] as unknown as Action[]);

      const r = new ActionRepository();

      const result = await r.getAggregationForItem(item.path, { view, types: [type] });
      expect(result).toEqual([{ actionCount: actions.length.toString() }]);
    });

    it('returns action count does not take into account sample size', async () => {
      const view = Context.Library;
      const sampleSize = 5;
      const actions = Array.from({ length: sampleSize }, () =>
        ActionFactory({ item, member, view }),
      ) as unknown as Action[];
      await rawRepository.save(actions);

      // noise
      await rawRepository.save([
        ActionFactory({ item, member, view }),
        ActionFactory({ item, member, view }),
      ] as unknown as Action[]);

      const r = new ActionRepository();

      const result = await r.getAggregationForItem(item.path, { view, sampleSize });
      expect(result).toEqual([{ actionCount: '7' }]);
    });

    describe('countGroupBy', () => {
      it('returns action count with countGroupBy ActionType and User', async () => {
        const view = Context.Library;
        const type = 'type';
        const sampleSize = 5;
        const bob = await saveMember();
        const countGroupBy = [CountGroupBy.ActionType, CountGroupBy.User];
        await rawRepository.save([
          ...Array.from({ length: sampleSize }, () => ActionFactory({ item, member, view, type })),
          ActionFactory({ item, member: bob, view, type: 'type1' }),
          ActionFactory({ item, member: bob, view, type: 'type2' }),
        ] as unknown as Action[]);

        const r = new ActionRepository();

        const result = await r.getAggregationForItem(item.path, { view, sampleSize }, countGroupBy);
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
        await rawRepository.save([
          ...Array.from({ length: sampleSize }, () =>
            ActionFactory({ item, view, member, geolocation: { country: 'switzerland' } }),
          ),
          ActionFactory({
            item,
            view,
            member,
            geolocation: { country: 'france' },
          }),
          ActionFactory({
            item,
            view,
            member,
            geolocation: { country: 'france' },
          }),
        ] as unknown as Action[]);

        const r = new ActionRepository();

        const result = await r.getAggregationForItem(item.path, { view }, countGroupBy);

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
        await rawRepository.save([
          ...Array.from({ length: sampleSize }, () =>
            ActionFactory({
              item,
              view,
              member,
              createdAt: '2000-12-17T03:24:00',
            }),
          ),
          ActionFactory({
            item,
            view,
            member,
            createdAt: '2000-12-18T03:24:00',
          }),
          ActionFactory({
            item,
            view,
            member,
            createdAt: '2000-12-19T03:24:00',
          }),
        ] as unknown as Action[]);

        const r = new ActionRepository();

        const result = await r.getAggregationForItem(item.path, { view }, countGroupBy);
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
        await rawRepository.save([
          ...Array.from({ length: sampleSize }, () =>
            ActionFactory({
              item,
              view,
              member,
              createdAt: '2000-12-17T03:24:00',
            }),
          ),
          ActionFactory({
            item,
            view,
            member,
            createdAt: '2000-12-18T03:24:00',
          }),
          ActionFactory({
            item,
            view,
            member,
            createdAt: '2000-12-19T03:24:00',
          }),
        ] as unknown as Action[]);

        const r = new ActionRepository();

        const result = await r.getAggregationForItem(item.path, { view }, countGroupBy);
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
        await rawRepository.save([
          ...Array.from({ length: sampleSize }, () =>
            ActionFactory({
              item,
              view,
              member,
              createdAt: '2000-12-17T03:24:00',
            }),
          ),
          ActionFactory({
            item,
            view,
            member,
            createdAt: '2000-12-18T13:24:00',
          }),
          ActionFactory({
            item,
            view,
            member,
            createdAt: '2000-12-19T23:24:00',
          }),
        ] as unknown as Action[]);

        const r = new ActionRepository();

        const result = await r.getAggregationForItem(item.path, { view }, countGroupBy);
        expect(result).toMatchObject([
          {
            actionCount: sampleSize.toString(),
            createdTimeOfDay: '3',
          },
          { actionCount: '1', createdTimeOfDay: '13' },
          { actionCount: '1', createdTimeOfDay: '23' },
        ]);
      });

      // TODO: this will change because item path will be item path
      it('returns action count with countGroupBy ItemId', async () => {
        const child1 = await saveItem({ actor: member, parentItem: item });
        const child2 = await saveItem({ actor: member, parentItem: item });
        const view = Context.Library;
        const sampleSize = 5;
        const countGroupBy = [CountGroupBy.ItemId];
        await rawRepository.save([
          ...Array.from({ length: sampleSize }, () =>
            ActionFactory({
              item,
              view,
              member,
            }),
          ),
          ActionFactory({
            item: child1 as any,
            view,
            member,
          }),
          ActionFactory({
            item: child2 as any,
            view,
            member,
          }),
        ] as unknown as Action[]);

        const r = new ActionRepository();

        const result = await r.getAggregationForItem(item.path, { view }, countGroupBy);
        expect(result).toContainEqual({
          actionCount: sampleSize.toString(),
          itemId: item.path,
        });
        expect(result).toContainEqual({ actionCount: '1', itemId: child1.path });
        expect(result).toContainEqual({ actionCount: '1', itemId: child2.path });
      });

      it('returns action count with countGroupBy User', async () => {
        const view = Context.Library;
        const type = 'type';
        const sampleSize = 5;
        const bob = await saveMember();
        const countGroupBy = [CountGroupBy.User];
        await rawRepository.save([
          ...Array.from({ length: sampleSize }, () => ActionFactory({ item, member, view, type })),
          ActionFactory({ item, member: bob, view, type: 'type1' }),
          ActionFactory({ item, member: bob, view, type: 'type2' }),
        ] as unknown as Action[]);

        const r = new ActionRepository();

        const result = await r.getAggregationForItem(item.path, { view, sampleSize }, countGroupBy);
        expect(result).toContainEqual({ actionCount: sampleSize.toString(), user: member.id });
        expect(result).toContainEqual({ actionCount: '2', user: bob.id });
      });
    });
    describe('aggregateFunction & aggregateMetric', () => {
      it.skip('returns action count with aggregateFunction for action type', async () => {
        const view = Context.Library;
        const sampleSize = 5;
        const countGroupBy = [CountGroupBy.ActionType];
        const aggregateFunction = AggregateFunction.Avg;
        const aggregateMetric = AggregateMetric.ActionType;
        await rawRepository.save([
          ...Array.from({ length: sampleSize }, () =>
            ActionFactory({ item, member, view, type: 'type' }),
          ),
          ActionFactory({ item, member, view, type: 'type1' }),
          ActionFactory({ item, member, view, type: 'type1' }),
        ] as unknown as Action[]);

        const r = new ActionRepository();

        const result = await r.getAggregationForItem(
          item.path,
          { view, sampleSize },
          countGroupBy,
          aggregateFunction,
          aggregateMetric,
        );
        expect(result).toContainEqual({ actionCount: '2', actionType: 'type1' });
        expect(result).toContainEqual({ actionCount: sampleSize.toString(), actionType: 'type' });
      });
    });
  });
});
