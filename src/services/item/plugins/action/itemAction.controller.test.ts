/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { ClientManager, Context, HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { actionsTable } from '../../../../drizzle/schema';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { CannotPostAction } from './errors';

const BUILDER_HOST = ClientManager.getInstance().getURLByContext(Context.Builder);

const uploadDoneMock = jest.fn(async () => console.debug('aws s3 storage upload'));
const deleteObjectMock = jest.fn(async () => console.debug('deleteObjectMock'));
const headObjectMock = jest.fn(async () => console.debug('headObjectMock'));
const MOCK_SIGNED_URL = 'signed-url';
jest.mock('@aws-sdk/client-s3', () => {
  return {
    GetObjectCommand: jest.fn(),
    S3: function () {
      return {
        deleteObject: deleteObjectMock,
        putObject: uploadDoneMock,
        headObject: headObjectMock,
      };
    },
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => {
  const getSignedUrl = jest.fn(async () => MOCK_SIGNED_URL);
  return {
    getSignedUrl,
  };
});
jest.mock('@aws-sdk/lib-storage', () => {
  return {
    Upload: jest.fn().mockImplementation(() => {
      return {
        done: uploadDoneMock,
      };
    }),
  };
});

const getActionsByItemId = async (itemId) => {
  return await db.query.actionsTable.findMany({
    where: eq(actionsTable.itemId, itemId),
  });
};

describe('Action Plugin Tests', () => {
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

  describe('POST /:id/actions', () => {
    describe('Sign Out', () => {
      it('Cannot post action when signed out', async () => {
        const {
          items: [item],
        } = await seedFromJson({ actor: null, items: [{}] });

        const body = {
          type: faker.word.sample(),
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: BUILDER_HOST.toString(),
          },
        });

        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        expect(
          await db.query.actionsTable.findFirst({ where: eq(actionsTable.type, body.type) }),
        ).toBeUndefined();
      });
    });
    describe('Public', () => {
      it('Post action for public item', async () => {
        const {
          items: [item],
        } = await seedFromJson({ actor: null, items: [{ isPublic: true }] });

        const body = {
          type: faker.word.sample(),
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: BUILDER_HOST.origin,
          },
        });

        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        const actions = await getActionsByItemId(item.id);
        expect(actions).toHaveLength(1);
        expect(actions[0].itemId).toEqual(item.id);
        expect(actions[0].accountId).toBeNull();
      });
    });
    describe('Signed in', () => {
      it('Post action with allowed origin', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const body = {
          type: faker.word.sample(),
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: BUILDER_HOST.origin,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        const actions = await getActionsByItemId(item.id);
        expect(actions).toHaveLength(1);
        expect(actions[0].itemId).toEqual(item.id);
        expect(actions[0].accountId).toEqual(actor.id);
      });
      it('Post action with extra', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const body = {
          type: faker.word.sample(),
          extra: { foo: faker.word.sample() },
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: BUILDER_HOST.origin,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        const actions = await getActionsByItemId(item.id);
        expect(actions).toHaveLength(1);
        expect(actions[0].itemId).toEqual(item.id);
        expect(actions[0].accountId).toEqual(actor.id);
      });
      it('Throw for non-allowed origin', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const body = {
          type: faker.word.sample(),
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: 'https://myorigin.com',
          },
        });
        expect(response.json().message).toEqual(new CannotPostAction().message);
        const actions = await getActionsByItemId(item.id);
        expect(actions).toHaveLength(0);
      });
      it('Throw for missing type', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const body = {
          extra: { prop: faker.word.sample() },
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: BUILDER_HOST.toString(),
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        const actions = await getActionsByItemId(item.id);
        expect(actions).toHaveLength(0);
      });
    });
  });

  describe('POST /:id/actions/export', () => {
    it('Create archive and send email', async () => {
      const mailerService = resolveDependency(MailerService);
      const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');
      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions/export`,
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });

    it('Create archive for item with an app and send email', async () => {
      const mailerService = resolveDependency(MailerService);
      const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');

      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [
          {
            type: ItemType.APP,
            appData: [
              { account: 'actor', creator: 'actor' },
              { account: 'actor', creator: 'actor' },
            ],
            appSettings: [{ creator: 'actor' }, { creator: 'actor' }],
            appActions: [{ account: 'actor' }, { account: 'actor' }],
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions/export`,
      });

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });

    it('Create archive if last export is old and send email', async () => {
      const mailerService = resolveDependency(MailerService);
      const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');

      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [
          {
            type: ItemType.APP,
            appData: [
              { account: 'actor', creator: 'actor' },
              { account: 'actor', creator: 'actor' },
            ],
            appSettings: [{ creator: 'actor' }, { creator: 'actor' }],
            appActions: [{ account: 'actor' }, { account: 'actor' }],
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            actionRequestExports: [
              {
                member: 'actor',
                createdAt: new Date('2021').toISOString(),
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions/export`,
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });

    it('Does not create archive if last export is recent, but send email', async () => {
      const mailerService = resolveDependency(MailerService);
      const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');

      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            actionRequestExports: [
              {
                member: 'actor',
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions/export`,
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).not.toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });
  });

  // describe('GET /:id/actions/aggregation', () => {
  //   it('Unauthorized if the user does not have any permission', async () => {
  //     const members = await saveMembers();
  //     const { item } = await testUtils.saveItemAndMembership({ member: members[0] });
  //     const parameters = {
  //       requestedSampleSize: '5000',
  //       view: Context.Builder,
  //       countGroupBy: ['user', 'createdDay', 'actionType'],
  //       aggregateFunction: 'avg',
  //       aggregateMetric: 'actionCount',
  //       aggregateBy: ['createdDay', 'actionType'],
  //     };
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `items/${item.id}/actions/aggregation`,
  //       query: parameters,
  //     });
  //     expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
  //   });
  //   it('Succeed if the user has READ permission', async () => {
  //     const members = await saveMembers();
  //     const { item } = await testUtils.saveItemAndMembership({ member: members[0] });
  //     await testUtils.saveMembership({
  //       item,
  //       account: actor,
  //       permission: PermissionLevel.Read,
  //     });
  //     const parameters = {
  //       requestedSampleSize: '5000',
  //       view: Context.Builder,
  //       countGroupBy: ['user', 'createdDay', 'actionType'],
  //       aggregateFunction: 'avg',
  //       aggregateMetric: 'actionCount',
  //       aggregateBy: ['createdDay', 'actionType'],
  //     };
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `items/${item.id}/actions/aggregation`,
  //       query: parameters,
  //     });
  //     expect(response.statusCode).toBe(StatusCodes.OK);
  //   });
  //   it('Successfully get the average action count aggregated by the createdDay and the actionType', async () => {
  //     const members = await saveMembers();
  //     const { item } = await testUtils.saveItemAndMembership({ member: actor });
  //     await saveActions(item, members);
  //     const parameters = {
  //       requestedSampleSize: '5000',
  //       view: Context.Builder,
  //       countGroupBy: ['user', 'createdDay', 'actionType'],
  //       aggregateFunction: 'avg',
  //       aggregateMetric: 'actionCount',
  //       aggregateBy: ['createdDay', 'actionType'],
  //       startDate: new Date('2023-05-19').toISOString(),
  //       endDate: new Date('2023-05-25').toISOString(),
  //     };
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `items/${item.id}/actions/aggregation`,
  //       query: parameters,
  //     });
  //     expect(response.statusCode).toEqual(StatusCodes.OK);
  //     const result = await response.json();
  //     const expectCreate = result.find((r) => r.actionType === ItemActionType.Create);
  //     expect(expectCreate).toBeDefined();
  //     expect(parseFloat(expectCreate['aggregateResult'])).toBeCloseTo(1);
  //     expect(expectCreate['createdDay']).toEqual('2023-05-20T00:00:00.000Z');
  //     const expectUpdate = result.find((r) => r.actionType === ItemActionType.Update);
  //     expect(expectUpdate).toBeDefined();
  //     expect(parseFloat(expectUpdate['aggregateResult'])).toBeCloseTo(1.33);
  //     expect(expectUpdate['createdDay']).toEqual('2023-05-21T00:00:00.000Z');
  //     const expectCollectionView = result.find(
  //       (r) => r.actionType === ActionTriggers.CollectionView,
  //     );
  //     expect(expectCollectionView).toBeDefined();
  //     expect(parseFloat(expectCollectionView['aggregateResult'])).toBeCloseTo(1);
  //     expect(expectCollectionView['createdDay']).toEqual('2023-05-21T00:00:00.000Z');
  //   });
  //   it('Successfully get the number of active user by day', async () => {
  //     const members = await saveMembers();
  //     const { item } = await testUtils.saveItemAndMembership({ member: actor });
  //     await saveActions(item, members);
  //     const parameters = {
  //       requestedSampleSize: '5000',
  //       view: Context.Builder,
  //       countGroupBy: ['user', 'createdDay'],
  //       aggregateFunction: 'count',
  //       aggregateMetric: 'actionCount',
  //       aggregateBy: ['createdDay'],
  //       startDate: new Date('2023-05-19').toISOString(),
  //       endDate: new Date('2023-05-25').toISOString(),
  //     };
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `items/${item.id}/actions/aggregation`,
  //       query: parameters,
  //     });
  //     expect(response.json()).toHaveProperty([0, 'aggregateResult']);
  //     expect(parseFloat(response.json()[0]['aggregateResult'])).toBeCloseTo(1);
  //     expect(response.json()).toHaveProperty([0, 'createdDay'], '2023-05-20T00:00:00.000Z');
  //     expect(response.json()).toHaveProperty([1, 'aggregateResult']);
  //     expect(parseFloat(response.json()[1]['aggregateResult'])).toBeCloseTo(3);
  //     expect(response.json()).toHaveProperty([1, 'createdDay'], '2023-05-21T00:00:00.000Z');
  //   });
  //   it('Successfully get the total action count aggregated by the actionType', async () => {
  //     const members = await saveMembers();
  //     const { item } = await testUtils.saveItemAndMembership({ member: actor });
  //     await saveActions(item, members);
  //     const parameters = {
  //       requestedSampleSize: '5000',
  //       view: Context.Builder,
  //       countGroupBy: ['actionType'],
  //       aggregateFunction: 'sum',
  //       aggregateMetric: 'actionCount',
  //       aggregateBy: ['actionType'],
  //       startDate: new Date('2023-05-19').toISOString(),
  //       endDate: new Date('2023-05-25').toISOString(),
  //     };
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `items/${item.id}/actions/aggregation`,
  //       query: parameters,
  //     });
  //     expect(response.statusCode).toEqual(StatusCodes.OK);
  //     const result = await response.json();
  //     const expectCreate = result.find((r) => r.actionType === ItemActionType.Create);
  //     expect(expectCreate).toBeDefined();
  //     expect(parseFloat(expectCreate['aggregateResult'])).toBeCloseTo(1);
  //     const expectUpdate = result.find((r) => r.actionType === ItemActionType.Update);
  //     expect(expectUpdate).toBeDefined();
  //     expect(parseFloat(expectUpdate['aggregateResult'])).toBeCloseTo(4);
  //     const expectCollectionView = result.find(
  //       (r) => r.actionType === ActionTriggers.CollectionView,
  //     );
  //     expect(expectCollectionView).toBeDefined();
  //     expect(parseFloat(expectCollectionView['aggregateResult'])).toBeCloseTo(1);
  //   });
  //   it('Successfully get the total action count within specific period', async () => {
  //     const members = await saveMembers();
  //     const { item } = await testUtils.saveItemAndMembership({ member: actor });
  //     await saveActions(item, members);
  //     const parameters = {
  //       requestedSampleSize: '5000',
  //       view: Context.Builder,
  //       countGroupBy: ['actionType'],
  //       aggregateFunction: 'sum',
  //       aggregateMetric: 'actionCount',
  //       aggregateBy: ['actionType'],
  //       startDate: new Date('2023-05-21').toISOString(),
  //       endDate: new Date('2023-05-25').toISOString(),
  //     };
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `items/${item.id}/actions/aggregation`,
  //       query: parameters,
  //     });
  //     const result = await response.json();
  //     const expectUpdate = result.find((r) => r.actionType === ItemActionType.Update);
  //     expect(expectUpdate).toBeDefined();
  //     expect(expectUpdate['aggregateResult']).toBeCloseTo(4);
  //     const expectCollectionView = result.find(
  //       (r) => r.actionType === ActionTriggers.CollectionView,
  //     );
  //     expect(expectCollectionView).toBeDefined();
  //     expect(expectCollectionView['aggregateResult']).toBeCloseTo(1);
  //   });
  //   it('Successfully get the total action count aggregated by time of day', async () => {
  //     const members = await saveMembers();
  //     const { item } = await testUtils.saveItemAndMembership({ member: actor });
  //     await saveActions(item, members);
  //     const parameters = {
  //       requestedSampleSize: '5000',
  //       view: Context.Builder,
  //       countGroupBy: ['createdTimeOfDay'],
  //       aggregateFunction: 'sum',
  //       aggregateMetric: 'actionCount',
  //       aggregateBy: ['createdTimeOfDay'],
  //       startDate: '2023-05-19T03:46:52.939Z',
  //       endDate: '2023-05-22T03:46:52.939Z',
  //     };
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `items/${item.id}/actions/aggregation`,
  //       query: parameters,
  //     });
  //     const result = await response.json();
  //     const expectCreatedAt3 = result.find((r) => r.createdTimeOfDay === '3');
  //     expect(expectCreatedAt3).toBeDefined();
  //     expect(parseFloat(expectCreatedAt3['aggregateResult'])).toBeCloseTo(2);
  //     const expectCreatedAt8 = result.find((r) => r.createdTimeOfDay === '8');
  //     expect(expectCreatedAt8).toBeDefined();
  //     expect(parseFloat(expectCreatedAt8['aggregateResult'])).toBeCloseTo(4);
  //   });
  //   it('Bad request if query parameters are invalid (aggregated by user)', async () => {
  //     const { item } = await testUtils.saveItemAndMembership({ member: actor });
  //     const parameters = {
  //       requestedSampleSize: '5000',
  //       view: Context.Builder,
  //       countGroupBy: ['user', 'createdDay', 'actionType'],
  //       aggregateFunction: 'avg',
  //       aggregateMetric: 'actionCount',
  //       aggregateBy: ['user', 'actionType'],
  //     };
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `items/${item.id}/actions/aggregation`,
  //       query: parameters,
  //     });
  //     expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
  //   });
  //   it('Bad request if query parameters are invalid (parameters mismatch)', async () => {
  //     const { item } = await testUtils.saveItemAndMembership({ member: actor });
  //     const parameters = {
  //       requestedSampleSize: '5000',
  //       view: Context.Builder,
  //       countGroupBy: ['user', 'createdDay'],
  //       aggregateFunction: 'avg',
  //       aggregateMetric: 'actionCount',
  //       aggregateBy: ['actionType'],
  //     };
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `items/${item.id}/actions/aggregation`,
  //       query: parameters,
  //     });
  //     expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
  //   });
  //   it('Bad request if query parameters are invalid (perform numeric function on a non numeric expression)', async () => {
  //     const { item } = await testUtils.saveItemAndMembership({ member: actor });
  //     const parameters = {
  //       requestedSampleSize: '5000',
  //       view: Context.Builder,
  //       countGroupBy: ['user', 'createdDay'],
  //       aggregateFunction: 'avg',
  //       aggregateMetric: 'user',
  //       aggregateBy: ['createdDay'],
  //     };
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `items/${item.id}/actions/aggregation`,
  //       query: parameters,
  //     });
  //     expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
  //   });
  // });
  // describe('GET /:id/actions', () => {
  //   it('Succeed if the user has READ permission', async () => {
  //     const {
  //       actor,
  //       items: [item],
  //     } = await seedFromJson({
  //       items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
  //     });
  //     mockAuthenticate(actor);
  //     assertIsDefined(actor);
  //     assertIsMember(actor);
  //     const members = await saveMembers();
  //     await saveActions(item, members);
  //     await rawActionRepository.save(
  //       getDummyAction(Context.Player, ActionTriggers.CollapseItem, new Date(), actor, item),
  //     );
  //     const parameters = {
  //       requestedSampleSize: '5000',
  //       view: Context.Player,
  //       startDate: '2024-12-16T03:24:00',
  //       endDate: '2024-12-20T03:24:00',
  //     };
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `items/${item.id}/actions`,
  //       query: parameters,
  //     });
  //     expect(response.statusCode).toBe(StatusCodes.OK);
  //   });
  // });
});
