import { faker } from '@faker-js/faker';
import { v4 } from 'uuid';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { Context } from '@graasp/sdk';

import build, {
  MOCK_LOGGER,
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { assertIsDefined } from '../../../../utils/assertions';
import { UnauthorizedMember } from '../../../../utils/errors';
import { ActionRepository } from '../../../action/action.repository';
import { ActionService } from '../../../action/action.service';
import { assertIsMember, assertIsMemberForTest } from '../../../authentication';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { MemberRepository } from '../../../member/member.repository';
import { resolveItemType } from '../../item';
import { ItemActionRepository } from './itemAction.repository';
import { ItemActionService } from './itemAction.service';
import { ItemActionType } from './utils';

const authorizedItemService = { getItemById: jest.fn() } as unknown as AuthorizedItemService;
const actionRepository = new ActionRepository();
const actionService = new ActionService(actionRepository, {} as MemberRepository, MOCK_LOGGER);

const service = new ItemActionService(
  actionService,
  authorizedItemService,
  actionRepository,
  new ItemMembershipRepository(),
  new ItemActionRepository(),
);

const MOCK_REQUEST = {
  headers: { origin: 'https://origin.com' },
  raw: {
    headers: { 'x-forwarded-for': '' },
    socket: { remoteAddress: 'address' },
  },
} as unknown as FastifyRequest;

describe('ItemActionService', () => {
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

      jest.spyOn(authorizedItemService, 'getItemById').mockResolvedValue(resolveItemType(item));

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

        jest.spyOn(authorizedItemService, 'getItemById').mockResolvedValue(resolveItemType(item));
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
              memberships: [{ account: 'actor', permission: 'admin' }],
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

        jest.spyOn(authorizedItemService, 'getItemById').mockResolvedValue(resolveItemType(item));

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
              memberships: [{ account: 'actor', permission: 'write' }],
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

        jest.spyOn(authorizedItemService, 'getItemById').mockResolvedValue(resolveItemType(item));

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
              memberships: [{ account: 'actor', permission: 'admin' }],
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

        jest.spyOn(authorizedItemService, 'getItemById').mockResolvedValue(resolveItemType(item));

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
              memberships: [{ account: 'actor', permission: 'admin' }],
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

        jest.spyOn(authorizedItemService, 'getItemById').mockResolvedValue(resolveItemType(item));

        const result = await service.getForItem(db, actor, item.id, {
          view: Context.Player,
        });

        expect(result).toHaveLength(3);
      });
    });
  });

  describe('post actions', () => {
    it('postPostAction', async () => {
      const {
        items: [item],
        actor,
      } = await seedFromJson({ items: [{}] });
      const actionPostMany = jest.spyOn(actionService, 'postMany').mockResolvedValue();
      assertIsDefined(actor);
      assertIsMember(actor);

      await service.postPostAction(db, { ...MOCK_REQUEST, user: { account: actor } }, item);
      expect(actionPostMany.mock.calls[0][1]).toEqual(actor);
      expect(actionPostMany.mock.calls[0][3]).toEqual([
        {
          item,
          type: ItemActionType.Create,
          extra: { itemId: item.id },
        },
      ]);
    });

    it('postPatchAction', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      const actionPostMany = jest.spyOn(actionService, 'postMany').mockResolvedValue();
      assertIsDefined(actor);
      assertIsMember(actor);

      const body = { name: faker.word.sample() };
      await service.postPatchAction(db, { ...MOCK_REQUEST, user: { account: actor }, body }, item);
      expect(actionPostMany.mock.calls[0][1]).toEqual(actor);
      expect(actionPostMany.mock.calls[0][3]).toEqual([
        {
          item,
          type: ItemActionType.Update,
          extra: { itemId: item.id, body },
        },
      ]);
    });

    it('postManyDeleteAction', async () => {
      const {
        items: [item1, item2],
        actor,
      } = await seedFromJson({
        items: [
          { memberships: [{ account: 'actor', permission: 'admin' }] },
          { memberships: [{ account: 'actor', permission: 'admin' }] },
        ],
      });
      assertIsDefined(actor);
      assertIsMember(actor);
      const actionPostMany = jest.spyOn(actionService, 'postMany').mockResolvedValue();

      await service.postManyDeleteAction(db, { ...MOCK_REQUEST, user: { account: actor } }, [
        item1,
        item2,
      ]);

      expect(actionPostMany.mock.calls[0][1]).toEqual(actor);
      expect(actionPostMany.mock.calls[0][3]).toEqual([
        {
          type: ItemActionType.Delete,
          extra: { itemId: item1.id },
        },
        {
          type: ItemActionType.Delete,
          extra: { itemId: item2.id },
        },
      ]);
    });

    it('postManyMoveAction', async () => {
      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
      });
      const actionPostMany = jest.spyOn(actionService, 'postMany').mockResolvedValue();
      assertIsDefined(actor);
      assertIsMember(actor);

      const body = { parentId: v4() };
      await service.postManyMoveAction(db, { ...MOCK_REQUEST, user: { account: actor }, body }, [
        item,
        item,
      ]);
      expect(actionPostMany.mock.calls[0][1]).toEqual(actor);
      expect(actionPostMany.mock.calls[0][3]).toEqual([
        {
          item,
          type: ItemActionType.Move,
          extra: { itemId: item.id, body },
        },
        {
          item,
          type: ItemActionType.Move,
          extra: { itemId: item.id, body },
        },
      ]);
    });

    it('postManyCopyAction', async () => {
      const {
        items: [item],
        actor,
      } = await seedFromJson({ items: [{}] });
      const actionPostMany = jest.spyOn(actionService, 'postMany').mockResolvedValue();
      assertIsDefined(actor);
      assertIsMember(actor);

      const body = { parentId: v4() };
      await service.postManyCopyAction(db, { ...MOCK_REQUEST, user: { account: actor }, body }, [
        item,
        item,
      ]);
      expect(actionPostMany.mock.calls[0][1]).toEqual(actor);
      expect(actionPostMany.mock.calls[0][3]).toEqual([
        {
          item,
          type: ItemActionType.Copy,
          extra: { itemId: item.id, body },
        },
        {
          item,
          type: ItemActionType.Copy,
          extra: { itemId: item.id, body },
        },
      ]);
    });
  });
});
