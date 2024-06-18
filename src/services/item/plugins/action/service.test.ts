import { v4 } from 'uuid';

import { FastifyBaseLogger, FastifyInstance } from 'fastify';

import {
  AggregateFunction,
  AggregateMetric,
  Context,
  CountGroupBy,
  PermissionLevel,
} from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app.js';
import { AppDataSource } from '../../../../plugins/datasource.js';
import { MemberCannotAccess, UnauthorizedMember } from '../../../../utils/errors.js';
import { buildRepositories } from '../../../../utils/repositories.js';
import { Action } from '../../../action/entities/action.js';
import { ActionService } from '../../../action/services/action.js';
import { MOCK_REQUEST } from '../../../action/services/action.test';
import { saveActions } from '../../../action/test/fixtures/actions.js';
import { MemberService } from '../../../member/service.js';
import { saveMember } from '../../../member/test/fixtures/members.js';
import { ThumbnailService } from '../../../thumbnail/service.js';
import { ItemService } from '../../service.js';
import { ItemTestUtils } from '../../test/fixtures/items.js';
import { ActionItemService } from './service.js';
import { ItemActionType } from './utils.js';

// mock datasource
jest.mock('../../../../plugins/datasource');
const itemService = new ItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as FastifyBaseLogger,
);
const memberService = new MemberService();
const service = new ActionItemService(
  new ActionService(itemService, memberService),
  itemService,
  memberService,
);
const rawRepository = AppDataSource.getRepository(Action);
const testUtils = new ItemTestUtils();

describe('ActionItemService', () => {
  let app: FastifyInstance;
  let actor;
  let item;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('getForItem', () => {
    it('throw for signed out user', async () => {
      ({ app } = await build({ member: null }));
      const bob = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: bob });
      // todo: update when testing memberships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemAny = item as any;
      await saveActions(rawRepository, [
        { item: itemAny, member: actor, view: Context.Builder },
        { item: itemAny, member: actor, view: Context.Builder },
        { item: itemAny, member: actor, view: Context.Builder },
      ]);
      await service.getForItem(actor, buildRepositories(), item.id).catch((e) => {
        expect(e).toBeInstanceOf(UnauthorizedMember);
      });
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
        // todo: update when testing memberships
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        item = i as any;
      });

      it('get actions for item for default view', async () => {
        const actions = await saveActions(rawRepository, [
          { item, member: actor, view: Context.Builder },
          { item, member: actor, view: Context.Builder },
          { item, member: actor, view: Context.Builder },
        ]);
        // noise
        await saveActions(rawRepository, [
          { item, member: actor, view: Context.Player },
          { item, member: actor, view: Context.Library },
          { item, member: actor, view: Context.Player },
        ]);
        const result = await service.getForItem(actor, buildRepositories(), item.id);

        expect(result).toHaveLength(actions.length);
      });

      it('get actions for all members when admin', async () => {
        const bob = await saveMember();
        const actions = await saveActions(rawRepository, [
          { item, member: actor, view: Context.Builder },
          { item, member: actor, view: Context.Builder },
          { item, member: actor, view: Context.Builder },
          { item, member: bob, view: Context.Builder },
          { item, member: bob, view: Context.Builder },
        ]);
        // noise
        const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
        await saveActions(rawRepository, [
          { item, member: actor, view: Context.Player },
          { item, member: actor, view: Context.Library },
          { item, member: actor, view: Context.Player },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { item: i as any, member: actor, view: Context.Player },
        ]);
        const result = await service.getForItem(actor, buildRepositories(), item.id);

        expect(result).toHaveLength(actions.length);
      });

      it('get only own actions for when writer', async () => {
        const bob = await saveMember();
        await testUtils.saveMembership({ item, member: bob, permission: PermissionLevel.Write });
        const actions = await saveActions(rawRepository, [
          { item, member: bob, view: Context.Builder },
          { item, member: bob, view: Context.Builder },
        ]);
        // noise
        const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
        await saveActions(rawRepository, [
          { item, member: actor, view: Context.Builder },
          { item, member: actor, view: Context.Player },
          { item, member: actor, view: Context.Library },
          { item, member: actor, view: Context.Player },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { item: i as any, member: actor, view: Context.Player },
        ]);
        const result = await service.getForItem(bob, buildRepositories(), item.id);

        expect(result).toHaveLength(actions.length);
      });

      it('get actions for given sample size', async () => {
        const bob = await saveMember();
        await saveActions(rawRepository, [
          { item, member: actor, view: Context.Builder },
          { item, member: actor, view: Context.Builder },
          { item, member: actor, view: Context.Builder },
          { item, member: bob, view: Context.Builder },
          { item, member: bob, view: Context.Builder },
        ]);
        // noise
        await saveActions(rawRepository, [
          { item, member: actor, view: Context.Player },
          { item, member: actor, view: Context.Library },
          { item, member: actor, view: Context.Player },
        ]);
        const result = await service.getForItem(actor, buildRepositories(), item.id, {
          sampleSize: 2,
        });

        expect(result).toHaveLength(2);
      });

      it('get actions for given view', async () => {
        const bob = await saveMember();
        const actions = await saveActions(rawRepository, [
          { item, member: actor, view: Context.Player },
          { item, member: actor, view: Context.Player },
          { item, member: actor, view: Context.Player },
          { item, member: bob, view: Context.Player },
          { item, member: bob, view: Context.Player },
        ]);
        // noise
        await saveActions(rawRepository, [
          { item, member: actor, view: Context.Builder },
          { item, member: actor, view: Context.Library },
          { item, member: actor, view: Context.Builder },
        ]);
        const result = await service.getForItem(actor, buildRepositories(), item.id, {
          view: Context.Player,
        });

        expect(result).toHaveLength(actions.length);
      });
    });
  });

  describe('getAnalyticsAggregation', () => {
    beforeEach(async () => {
      ({ app, actor } = await build());
      const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
      // todo: update when testing memberships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item = i as any;
    });
    it('throw if no access to item', async () => {
      const bob = await saveMember();
      const { item: itemNoMembership } = await testUtils.saveItemAndMembership({ member: bob });
      // todo: update when testing memberships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemAny = itemNoMembership as any;
      await saveActions(rawRepository, [
        { item: itemAny, member: actor, view: Context.Builder },
        { item: itemAny, member: actor, view: Context.Builder },
        { item: itemAny, member: actor, view: Context.Builder },
      ]);
      await service
        .getAnalyticsAggregation(actor, buildRepositories(), {
          itemId: item.id,
          countGroupBy: [CountGroupBy.ActionLocation],
          aggregationParams: {
            aggregateFunction: AggregateFunction.Avg,
            aggregateMetric: AggregateMetric.ActionCount,
          },
        })
        .catch((e) => {
          expect(e).toBeInstanceOf(MemberCannotAccess);
        });
    });
    it('get aggregated actions', async () => {
      await saveActions(rawRepository, [
        { item, member: actor, view: Context.Player },
        { item, member: actor, view: Context.Player },
        { item, member: actor, view: Context.Player },
      ]);
      // noise
      await saveActions(rawRepository, [
        { item, member: actor, view: Context.Builder },
        { item, member: actor, view: Context.Library },
        { item, member: actor, view: Context.Builder },
      ]);
      const result = await service.getAnalyticsAggregation(actor, buildRepositories(), {
        itemId: item.id,
        view: Context.Player,
        countGroupBy: [CountGroupBy.User],
      });
      expect(result).toMatchObject([{ actionCount: '3', user: actor.id }]);
    });
  });

  describe('getBaseAnalyticsForItem', () => {
    beforeEach(async () => {
      ({ app, actor } = await build());
      const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
      // todo: update when testing memberships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item = i as any;
    });
    it('throw if no access to item', async () => {
      const bob = await saveMember();
      const { item: itemNoMembership } = await testUtils.saveItemAndMembership({ member: bob });
      // todo: update when testing memberships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemAny = itemNoMembership as any;
      await saveActions(rawRepository, [
        { item: itemAny, member: actor, view: Context.Builder },
        { item: itemAny, member: actor, view: Context.Builder },
        { item: itemAny, member: actor, view: Context.Builder },
      ]);
      await service
        .getBaseAnalyticsForItem(actor, buildRepositories(), {
          itemId: item.id,
        })
        .catch((e) => {
          expect(e).toBeInstanceOf(MemberCannotAccess);
        });
    });

    it('get only own analytics', async () => {
      const sampleSize = 5;
      const bob = await saveMember();
      await testUtils.saveMembership({ member: bob, item, permission: PermissionLevel.Write });
      const { item: itemNoMembership } = await testUtils.saveItemAndMembership({
        member: bob,
        creator: actor,
      });

      // actions
      // todo: update when testing memberships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemAny = itemNoMembership as any;
      const actions = await saveActions(rawRepository, [
        { item, member: bob, view: Context.Player },
        { item, member: bob, view: Context.Player },
        { item, member: bob, view: Context.Player },
      ]);
      // noise
      await saveActions(rawRepository, [
        { item: itemAny, member: actor, view: Context.Builder },
        { item: itemAny, member: actor, view: Context.Builder },
        { item: itemAny, member: actor, view: Context.Builder },
      ]);

      // descendants
      await testUtils.saveItems({ nb: 3, parentItem: item, actor: bob });

      const baseAnalytics = await service.getBaseAnalyticsForItem(bob, buildRepositories(), {
        itemId: item.id,
        sampleSize,
      });
      expect(baseAnalytics.actions).toHaveLength(actions.length);
      expect(baseAnalytics.item.id).toEqual(item.id);
      expect(baseAnalytics.item.name).toEqual(item.name);
      expect(baseAnalytics.item.creator?.name).toEqual(item.creator.name);
      expect(baseAnalytics.descendants).toHaveLength(3);
      expect(baseAnalytics.metadata).toMatchObject({
        numActionsRetrieved: actions.length,
        requestedSampleSize: sampleSize,
      });
      expect(baseAnalytics.itemMemberships).toHaveLength(2);
    });
  });

  describe('post actions', () => {
    beforeEach(async () => {
      ({ app, actor } = await build());
      const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
      // todo: update when testing memberships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item = i as any;
    });

    it('postPostAction', async () => {
      await service.postPostAction(MOCK_REQUEST, buildRepositories(), item);
      const [action] = await rawRepository.find();
      expect(action.type).toEqual(ItemActionType.Create);
      expect(action.extra).toMatchObject({ itemId: item.id });
    });

    it('postPatchAction', async () => {
      const body = { name: 'new name' };
      await service.postPatchAction({ ...MOCK_REQUEST, body }, buildRepositories(), item);
      const [action] = await rawRepository.find();
      expect(action.type).toEqual(ItemActionType.Update);
      expect(action.extra).toMatchObject({ itemId: item.id, body });
    });

    it('postManyPatchAction', async () => {
      const body = { name: 'new name' };
      await service.postManyPatchAction({ ...MOCK_REQUEST, body }, buildRepositories(), [
        item,
        item,
      ]);
      const [action1, action2] = await rawRepository.find();
      expect(action1.type).toEqual(ItemActionType.Update);
      expect(action1.extra).toMatchObject({ itemId: item.id });
      expect(action2.type).toEqual(ItemActionType.Update);
      expect(action2.extra).toMatchObject({ itemId: item.id });
    });

    it('postManyDeleteAction', async () => {
      await service.postManyDeleteAction(MOCK_REQUEST, buildRepositories(), [item, item]);
      const [action1, action2] = await rawRepository.find();
      expect(action1.type).toEqual(ItemActionType.Delete);
      expect(action1.extra).toMatchObject({ itemId: item.id });
      expect(action2.type).toEqual(ItemActionType.Delete);
      expect(action2.extra).toMatchObject({ itemId: item.id });
    });

    it('postManyMoveAction', async () => {
      const body = { parentId: v4() };
      await service.postManyMoveAction({ ...MOCK_REQUEST, body }, buildRepositories(), [
        item,
        item,
      ]);
      const [action1, action2] = await rawRepository.find();
      expect(action1.type).toEqual(ItemActionType.Move);
      expect(action1.extra).toMatchObject({ itemId: item.id, body });
      expect(action2.type).toEqual(ItemActionType.Move);
      expect(action2.extra).toMatchObject({ itemId: item.id });
    });

    it('postManyCopyAction', async () => {
      const body = { parentId: v4() };
      await service.postManyCopyAction({ ...MOCK_REQUEST, body }, buildRepositories(), [
        item,
        item,
      ]);
      const [action1, action2] = await rawRepository.find();
      expect(action1.type).toEqual(ItemActionType.Copy);
      expect(action1.extra).toMatchObject({ itemId: item.id, body });
      expect(action2.type).toEqual(ItemActionType.Copy);
      expect(action2.extra).toMatchObject({ itemId: item.id });
    });
  });
});
