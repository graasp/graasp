import { faker } from '@faker-js/faker';
import { addDays, formatISO } from 'date-fns';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import {
  AggregateFunction,
  AggregateMetric,
  Context,
  CountGroupBy,
  ItemType,
  PermissionLevel,
} from '@graasp/sdk';

import build, {
  MOCK_LOGGER,
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { BaseLogger } from '../../../../logger';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { MemberCannotAccess, UnauthorizedMember } from '../../../../utils/errors';
import { MemberService } from '../../../member/member.service';
import { saveMember } from '../../../member/test/fixtures/members';
import { ThumbnailService } from '../../../thumbnail/service';
import { ItemService } from '../../service';
import { expectItem } from '../../test/fixtures/items';
import { saveAppActions } from '../app/appAction/test/fixtures';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { ActionItemService } from './action.service';
import { ItemActionType } from './utils';

const itemService = new ItemService(
  {} as ThumbnailService,
  {} as ItemThumbnailService,
  {} as MeiliSearchWrapper,
  {} as BaseLogger,
);
const memberService = new MemberService({} as MailerService, {} as BaseLogger);
const service = new ActionItemService(
  new ActionService(itemService, memberService, MOCK_LOGGER),
  itemService,
);

describe('ActionItemService', () => {
  let app: FastifyInstance;
  let actor;
  let item;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
    actor = null;
  });

  describe('getForItem', () => {
    it('throw for signed out user', async () => {
      const bob = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: bob });
      // todo: update when testing memberships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemAny = item as any;
      await saveActions([
        { item: itemAny, account: actor, view: Context.Builder },
        { item: itemAny, account: actor, view: Context.Builder },
        { item: itemAny, account: actor, view: Context.Builder },
      ]);
      await service.getForItem(app.db, actor, item.id).catch((e) => {
        expect(e).toBeInstanceOf(UnauthorizedMember);
      });
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
        const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
        // todo: update when testing memberships
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        item = i as any;
      });

      it('get actions for item for default view', async () => {
        const actions = await saveActions([
          {
            item,
            account: actor,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: actor,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: actor,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
        ]);
        // noise
        await saveActions([
          { item, account: actor, view: Context.Player },
          { item, account: actor, view: Context.Library },
          { item, account: actor, view: Context.Player },
        ]);
        const result = await service.getForItem(app.db, actor, item.id);

        expect(result).toHaveLength(actions.length);
      });

      it('get actions for all members when admin', async () => {
        const bob = await saveMember();
        const actions = await saveActions([
          {
            item,
            account: actor,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: actor,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: actor,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: bob,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: bob,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
        ]);
        // noise
        const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
        await saveActions([
          { item, account: actor, view: Context.Player },
          { item, account: actor, view: Context.Library },
          { item, account: actor, view: Context.Player },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { item: i as any, account: actor, view: Context.Player },
        ]);
        const result = await service.getForItem(app.db, actor, item.id);

        expect(result).toHaveLength(actions.length);
      });

      it('get only own actions for when writer', async () => {
        const bob = await saveMember();
        await testUtils.saveMembership({ item, account: bob, permission: PermissionLevel.Write });
        const actions = await saveActions([
          {
            item,
            account: bob,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: bob,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
        ]);
        // noise
        const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
        await saveActions([
          { item, account: actor, view: Context.Builder },
          { item, account: actor, view: Context.Player },
          { item, account: actor, view: Context.Library },
          { item, account: actor, view: Context.Player },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { item: i as any, account: actor, view: Context.Player },
        ]);
        const result = await service.getForItem(app.db, bob, item.id);

        expect(result).toHaveLength(actions.length);
      });

      it('get actions for given sample size', async () => {
        const bob = await saveMember();
        await saveActions([
          {
            item,
            account: actor,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: actor,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: actor,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: bob,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: bob,
            view: Context.Builder,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
        ]);
        // noise
        await saveActions([
          { item, account: actor, view: Context.Player },
          { item, account: actor, view: Context.Library },
          { item, account: actor, view: Context.Player },
        ]);
        const result = await service.getForItem(app.db, actor, item.id, {
          sampleSize: 2,
        });

        expect(result).toHaveLength(2);
      });

      it('get actions for given view', async () => {
        const bob = await saveMember();
        const actions = await saveActions([
          {
            item,
            account: actor,
            view: Context.Player,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: actor,
            view: Context.Player,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: actor,
            view: Context.Player,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: bob,
            view: Context.Player,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
          {
            item,
            account: bob,
            view: Context.Player,
            createdAt: formatISO(addDays(new Date(), -1)),
          },
        ]);
        // noise
        await saveActions([
          { item, account: actor, view: Context.Builder },
          { item, account: actor, view: Context.Library },
          { item, account: actor, view: Context.Builder },
        ]);
        const result = await service.getForItem(app.db, actor, item.id, {
          view: Context.Player,
        });

        expect(result).toHaveLength(actions.length);
      });
    });
  });

  describe('getAnalyticsAggregation', () => {
    beforeEach(async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
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
      await saveActions([
        { item: itemAny, account: actor, view: Context.Builder },
        { item: itemAny, account: actor, view: Context.Builder },
        { item: itemAny, account: actor, view: Context.Builder },
      ]);
      await service
        .getAnalyticsAggregation(app.db, actor, {
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
      await saveActions([
        {
          item,
          account: actor,
          view: Context.Player,
          createdAt: formatISO(addDays(new Date(), -1)),
        },
        {
          item,
          account: actor,
          view: Context.Player,
          createdAt: formatISO(addDays(new Date(), -1)),
        },
        {
          item,
          account: actor,
          view: Context.Player,
          createdAt: formatISO(addDays(new Date(), -1)),
        },
      ]);
      // noise
      await saveActions([
        { item, account: actor, view: Context.Builder },
        { item, account: actor, view: Context.Library },
        { item, account: actor, view: Context.Builder },
      ]);
      const result = await service.getAnalyticsAggregation(app.db, actor, {
        itemId: item.id,
        view: Context.Player,
        countGroupBy: [CountGroupBy.User],
      });
      expect(result).toMatchObject([{ actionCount: '3', user: actor.id }]);
    });

    it('get aggregated actions within specific period', async () => {
      await saveActions([
        {
          item,
          account: actor,
          view: Context.Player,
          createdAt: new Date('2024-06-08').toISOString(),
        },
        {
          item,
          account: actor,
          view: Context.Player,
          createdAt: new Date('2024-07-08').toISOString(),
        },
        {
          item,
          account: actor,
          view: Context.Player,
          createdAt: new Date('2024-06-18').toISOString(),
        },
      ]);
      // noise
      await saveActions([
        { item, account: actor, view: Context.Builder },
        { item, account: actor, view: Context.Library },
        { item, account: actor, view: Context.Builder },
      ]);
      const result = await service.getAnalyticsAggregation(app.db, actor, {
        itemId: item.id,
        view: Context.Player,
        countGroupBy: [CountGroupBy.User],
        startDate: new Date('2024-07-01').toISOString(),
        endDate: new Date('2024-07-10').toISOString(),
      });
      expect(result).toMatchObject([{ actionCount: '1', user: actor.id }]);
    });
  });

  describe('getBaseAnalyticsForItem', () => {
    beforeEach(async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
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
      await saveActions([
        { item: itemAny, account: actor, view: Context.Builder },
        { item: itemAny, account: actor, view: Context.Builder },
        { item: itemAny, account: actor, view: Context.Builder },
      ]);
      await service
        .getBaseAnalyticsForItem(app.db, actor, {
          itemId: item.id,
        })
        .catch((e) => {
          expect(e).toBeInstanceOf(MemberCannotAccess);
        });
    });

    it('get only own analytics', async () => {
      const sampleSize = 5;
      const bob = await saveMember();
      await testUtils.saveMembership({ account: bob, item, permission: PermissionLevel.Write });
      const { item: itemNoMembership } = await testUtils.saveItemAndMembership({
        member: bob,
        creator: actor,
      });

      // actions
      // todo: update when testing memberships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemAny = itemNoMembership as any;
      const actions = await saveActions([
        { item, account: bob, view: Context.Player, createdAt: formatISO(addDays(new Date(), -1)) },
        {
          item,
          account: bob,
          view: Context.Player,
          createdAt: formatISO(addDays(new Date(), -10)),
        },
        { item, account: bob, view: Context.Player, createdAt: formatISO(addDays(new Date(), -5)) },
      ]);

      // noise
      await saveActions([
        { item: itemAny, account: actor, view: Context.Builder },
        { item: itemAny, account: actor, view: Context.Builder },
        { item: itemAny, account: actor, view: Context.Builder },
      ]);

      // descendants
      await testUtils.saveItems({ nb: 3, parentItem: item, member: bob });

      const baseAnalytics = await service.getBaseAnalyticsForItem(
        app.db,
        bob,

        {
          itemId: item.id,
          sampleSize,
        },
      );
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

    it('get analytics within specific period', async () => {
      const sampleSize = 5;

      // actions
      await saveActions([
        {
          item,
          account: actor,
          view: Context.Player,
          createdAt: new Date('2024-06-01').toISOString(),
        },
        {
          item,
          account: actor,
          view: Context.Player,
          createdAt: new Date('2024-07-02').toISOString(),
        },
        {
          item,
          account: actor,
          view: Context.Player,
          createdAt: new Date('2024-07-11').toISOString(),
        },
      ]);

      const baseAnalytics = await service.getBaseAnalyticsForItem(
        app.db,
        actor,

        {
          itemId: item.id,
          sampleSize,
          startDate: new Date('2024-07-01').toISOString(),
          endDate: new Date('2024-07-10').toISOString(),
        },
      );
      expect(baseAnalytics.actions).toHaveLength(1);
      expect(baseAnalytics.item.id).toEqual(item.id);
    });

    it('get item data for app actions', async () => {
      const { item } = await testUtils.saveItemAndMembership({
        item: { type: ItemType.APP },
        member: actor,
      });

      // app actions
      await saveAppActions({ item, member: actor });

      const baseAnalytics = await service.getBaseAnalyticsForItem(
        app.db,
        actor,

        {
          itemId: item.id,
        },
      );
      for (const appAction of baseAnalytics.apps[item.id].actions) {
        expectItem(appAction.item, item);
      }
    });
  });

  describe('post actions', () => {
    beforeEach(async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
      const { item: i } = await testUtils.saveItemAndMembership({ member: actor });
      // todo: update when testing memberships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item = i as any;
    });

    it('postPostAction', async () => {
      await service.postPostAction(app.db, MOCK_REQUEST, item);
      const actions = await rawRepository.findBy({
        type: ItemActionType.Create,
        extra: { itemId: item.id },
      });
      expect(actions).toHaveLength(1);
    });

    it('postPatchAction', async () => {
      const body = { name: faker.word.sample() };
      await service.postPatchAction(app.db, { ...MOCK_REQUEST, body }, item);
      const actions = await rawRepository.findBy({
        type: ItemActionType.Update,
        item: { id: item.id },
      });
      expect(actions).toHaveLength(1);
      expect(actions[0].extra).toMatchObject({ itemId: item.id, body });
    });

    it('postManyDeleteAction', async () => {
      await service.postManyDeleteAction(app.db, MOCK_REQUEST, [item, item]);
      const actions = await rawRepository.findBy({
        extra: { itemId: item.id },
        type: ItemActionType.Delete,
      });
      expect(actions).toHaveLength(2);
      expect(actions[0].extra).toMatchObject({ itemId: item.id });
      expect(actions[1].extra).toMatchObject({ itemId: item.id });
    });

    it('postManyMoveAction', async () => {
      const body = { parentId: v4() };
      await service.postManyMoveAction(app.db, { ...MOCK_REQUEST, body }, [item, item]);
      const actions = await rawRepository.findBy({
        item: { id: item.id },
        type: ItemActionType.Move,
      });
      expect(actions).toHaveLength(2);
      expect(actions[0].extra).toMatchObject({ itemId: item.id, body });
      expect(actions[1].extra).toMatchObject({ itemId: item.id, body });
    });

    it('postManyCopyAction', async () => {
      const body = { parentId: v4() };
      await service.postManyCopyAction(app.db, { ...MOCK_REQUEST, body }, [item, item]);
      const actions = await rawRepository.findBy({
        item: { id: item.id },
        type: ItemActionType.Copy,
      });
      expect(actions).toHaveLength(2);
      expect(actions[0].extra).toMatchObject({ itemId: item.id, body });
      expect(actions[1].extra).toMatchObject({ itemId: item.id, body });
    });
  });
});
