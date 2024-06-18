/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { StatusCodes } from 'http-status-codes';
import waitForExpectDefault from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { Context, HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app.js';
import { AppDataSource } from '../../../../../plugins/datasource.js';
import { BUILDER_HOST, ITEMS_ROUTE_PREFIX } from '../../../../../utils/config.js';
import { Action } from '../../../../action/entities/action.js';
import { saveMember, saveMembers } from '../../../../member/test/fixtures/members.js';
import { ItemTestUtils } from '../../../test/fixtures/items.js';
import { saveAppActions } from '../../app/appAction/test/fixtures.js';
import { saveAppData } from '../../app/appData/test/fixtures.js';
import { saveAppSettings } from '../../app/appSetting/test/fixtures.js';
import { CannotPostAction } from '../errors.js';
import { ActionRequestExportRepository } from '../requestExport/repository.js';
import { ItemActionType } from '../utils.js';
import { saveActions } from './fixtures/actions.js';

const waitForExpect = waitForExpectDefault.default;

// mock datasource
jest.mock('../../../../../plugins/datasource');

const rawActionRepository = AppDataSource.getRepository(Action);
const testUtils = new ItemTestUtils();

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

describe('Action Plugin Tests', () => {
  let app: FastifyInstance;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('POST /:id/actions', () => {
    describe('Sign Out', () => {
      it('Cannot post action when signed out', async () => {
        ({ app, actor } = await build({ member: null }));
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          member,
        });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body: {
            type: 'view',
          },
          headers: {
            Origin: BUILDER_HOST.url.toString(),
          },
        });

        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        expect(await rawActionRepository.count()).toEqual(0);
      });
    });
    describe('Public', () => {
      it('Post action for public item', async () => {
        ({ app, actor } = await build({ member: null }));
        const member = await saveMember();
        const { item } = await testUtils.savePublicItem({ actor: member });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body: {
            type: 'view',
          },
          headers: {
            Origin: BUILDER_HOST.url.origin,
          },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        const [action] = await rawActionRepository.find({
          relations: { item: true, member: true },
        });
        expect(action.type).toEqual('view');
        expect(action.item!.id).toEqual(item.id);
        expect(action.member).toBeNull();
      });
    });
    describe('Signed in', () => {
      let item;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await testUtils.saveItemAndMembership({
          member: actor,
        }));
      });

      it('Post action with allowed origin', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body: {
            type: 'view',
          },
          headers: {
            Origin: BUILDER_HOST.url.origin,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const [action] = await rawActionRepository.find({
          relations: { item: true, member: true },
        });
        expect(action.type).toEqual('view');
        expect(action.item!.id).toEqual(item.id);
        expect(action.member!.id).toEqual(actor.id);
      });

      it('Post action with extra', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body: {
            type: 'view',
            extra: { foo: 'bar' },
          },
          headers: {
            Origin: BUILDER_HOST.url.origin,
          },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        const [action] = await rawActionRepository.find({
          relations: { item: true, member: true },
        });
        expect(action.type).toEqual('view');
        expect(action.item!.id).toEqual(item.id);
        expect(action.member!.id).toEqual(actor.id);
        expect(action.extra.foo).toEqual('bar');
      });

      it('Throw for non-allowed origin', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body: {
            type: 'view',
          },
          headers: {
            Origin: 'https://myorigin.com',
          },
        });
        expect(response.json().message).toEqual(new CannotPostAction().message);
        expect(await rawActionRepository.count()).toEqual(0);
      });

      it('Throw for missing type', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body: {},
          headers: {
            Origin: BUILDER_HOST.url.toString(),
          },
        });

        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        expect(await rawActionRepository.count()).toEqual(0);
      });
    });
  });

  describe('POST /:id/actions/export', () => {
    it('Create archive and send email', async () => {
      ({ app, actor } = await build());
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');

      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
      });

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
      ({ app, actor } = await build());
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');

      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
      });
      const { item: appItem } = await testUtils.saveItemAndMembership({
        item: { type: ItemType.APP },
        parentItem: item,
        member: actor,
      });
      await saveAppData({ item: appItem, creator: actor });
      await saveAppActions({ item: appItem, member: actor });
      await saveAppSettings({ item: appItem, creator: actor });

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
      ({ app, actor } = await build());
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');

      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
      });

      await ActionRequestExportRepository.save({
        item,
        member: actor,
        createdAt: new Date('2021'),
      });

      // another item to add noise
      const { item: otherItem } = await testUtils.saveItemAndMembership({
        member: actor,
      });
      await ActionRequestExportRepository.save({
        item: otherItem,
        member: actor,
        createdAt: new Date(),
      });

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
      ({ app, actor } = await build());
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');

      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
      });

      await ActionRequestExportRepository.save({
        item,
        member: actor,
        createdAt: new Date(),
      });

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

  describe('GET /:id/actions/aggregation', () => {
    beforeEach(async () => {
      ({ app, actor } = await build());
    });

    it('Unauthorized if the user does not have any permission', async () => {
      const members = await saveMembers();
      const { item } = await testUtils.saveItemAndMembership({ member: members[0] });

      const parameters = {
        requestedSampleSize: '5000',
        view: Context.Builder,
        countGroupBy: ['user', 'createdDay', 'actionType'],
        aggregateFunction: 'avg',
        aggregateMetric: 'actionCount',
        aggregateBy: ['createdDay', 'actionType'],
      };
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `items/${item.id}/actions/aggregation`,
        query: parameters,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it('Succeed if the user has READ permission', async () => {
      const members = await saveMembers();
      const { item } = await testUtils.saveItemAndMembership({ member: members[0] });
      await testUtils.saveMembership({
        item,
        member: actor,
        permission: PermissionLevel.Read,
      });

      const parameters = {
        requestedSampleSize: '5000',
        view: Context.Builder,
        countGroupBy: ['user', 'createdDay', 'actionType'],
        aggregateFunction: 'avg',
        aggregateMetric: 'actionCount',
        aggregateBy: ['createdDay', 'actionType'],
      };
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `items/${item.id}/actions/aggregation`,
        query: parameters,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
    });

    it('Successfully get the average action count aggregated by the createdDay and the actionType', async () => {
      const members = await saveMembers();
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      await saveActions(item, members);

      const parameters = {
        requestedSampleSize: '5000',
        view: Context.Builder,
        countGroupBy: ['user', 'createdDay', 'actionType'],
        aggregateFunction: 'avg',
        aggregateMetric: 'actionCount',
        aggregateBy: ['createdDay', 'actionType'],
      };
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `items/${item.id}/actions/aggregation`,
        query: parameters,
      });

      expect(response.json()).toHaveProperty([0, 'actionType'], ItemActionType.Create);
      expect(response.json()).toHaveProperty([0, 'aggregateResult']);
      expect(parseFloat(response.json()[0]['aggregateResult'])).toBeCloseTo(1);
      expect(response.json()).toHaveProperty([0, 'createdDay'], '2023-05-20T00:00:00.000Z');

      expect(response.json()).toHaveProperty([1, 'actionType'], ItemActionType.Update);
      expect(response.json()).toHaveProperty([1, 'aggregateResult']);
      expect(parseFloat(response.json()[1]['aggregateResult'])).toBeCloseTo(1.33);
      expect(response.json()).toHaveProperty([1, 'createdDay'], '2023-05-21T00:00:00.000Z');
    });

    it('Successfully get the number of active user by day', async () => {
      const members = await saveMembers();
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      await saveActions(item, members);

      const parameters = {
        requestedSampleSize: '5000',
        view: Context.Builder,
        countGroupBy: ['user', 'createdDay'],
        aggregateFunction: 'count',
        aggregateMetric: 'actionCount',
        aggregateBy: ['createdDay'],
      };
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `items/${item.id}/actions/aggregation`,
        query: parameters,
      });

      expect(response.json()).toHaveProperty([0, 'aggregateResult']);
      expect(parseFloat(response.json()[0]['aggregateResult'])).toBeCloseTo(1);
      expect(response.json()).toHaveProperty([0, 'createdDay'], '2023-05-20T00:00:00.000Z');

      expect(response.json()).toHaveProperty([1, 'aggregateResult']);
      expect(parseFloat(response.json()[1]['aggregateResult'])).toBeCloseTo(3);
      expect(response.json()).toHaveProperty([1, 'createdDay'], '2023-05-21T00:00:00.000Z');
    });

    it('Successfully get the total action count aggregated by the actionType', async () => {
      const members = await saveMembers();
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      await saveActions(item, members);

      const parameters = {
        requestedSampleSize: '5000',
        view: Context.Builder,
        countGroupBy: ['actionType'],
        aggregateFunction: 'sum',
        aggregateMetric: 'actionCount',
        aggregateBy: ['actionType'],
      };
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `items/${item.id}/actions/aggregation`,
        query: parameters,
      });

      expect(response.json()).toHaveProperty([0, 'actionType'], ItemActionType.Create);
      expect(response.json()).toHaveProperty([0, 'aggregateResult']);
      expect(parseFloat(response.json()[0]['aggregateResult'])).toBeCloseTo(1);

      expect(response.json()).toHaveProperty([1, 'actionType'], ItemActionType.Update);
      expect(response.json()).toHaveProperty([1, 'aggregateResult']);
      expect(parseFloat(response.json()[1]['aggregateResult'])).toBeCloseTo(4);
    });

    it('Successfully get the total action count aggregated by time of day', async () => {
      const members = await saveMembers();
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      await saveActions(item, members);

      const parameters = {
        requestedSampleSize: '5000',
        view: Context.Builder,
        countGroupBy: ['createdTimeOfDay'],
        aggregateFunction: 'sum',
        aggregateMetric: 'actionCount',
        aggregateBy: ['createdTimeOfDay'],
      };
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `items/${item.id}/actions/aggregation`,
        query: parameters,
      });

      expect(response.json()).toHaveProperty([0, 'createdTimeOfDay'], '3');
      expect(response.json()).toHaveProperty([0, 'aggregateResult']);
      expect(parseFloat(response.json()[0]['aggregateResult'])).toBeCloseTo(1);

      expect(response.json()).toHaveProperty([1, 'createdTimeOfDay'], '8');
      expect(response.json()).toHaveProperty([1, 'aggregateResult']);
      expect(parseFloat(response.json()[1]['aggregateResult'])).toBeCloseTo(4);
    });

    it('Bad request if query parameters are invalid (aggregated by user)', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });

      const parameters = {
        requestedSampleSize: '5000',
        view: Context.Builder,
        countGroupBy: ['user', 'createdDay', 'actionType'],
        aggregateFunction: 'avg',
        aggregateMetric: 'actionCount',
        aggregateBy: ['user', 'actionType'],
      };
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `items/${item.id}/actions/aggregation`,
        query: parameters,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Bad request if query parameters are invalid (parameters mismatch)', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });

      const parameters = {
        requestedSampleSize: '5000',
        view: Context.Builder,
        countGroupBy: ['user', 'createdDay'],
        aggregateFunction: 'avg',
        aggregateMetric: 'actionCount',
        aggregateBy: ['actionType'],
      };
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `items/${item.id}/actions/aggregation`,
        query: parameters,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Bad request if query parameters are invalid (perform numeric function on a non numeric expression)', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });

      const parameters = {
        requestedSampleSize: '5000',
        view: Context.Builder,
        countGroupBy: ['user', 'createdDay'],
        aggregateFunction: 'avg',
        aggregateMetric: 'user',
        aggregateBy: ['createdDay'],
      };
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `items/${item.id}/actions/aggregation`,
        query: parameters,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
  });
});
