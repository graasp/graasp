/**
 * These tests make sure we keep legacy properties to ensure compatibility with old apps
 * We continue to send "member" for legacy apps
 * */
import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../../test/app';
import { APP_ITEMS_PREFIX } from '../../../../../../utils/config';
import { Member } from '../../../../../member/entities/member';
import { AppTestUtils } from '../../test/fixtures';
import { saveAppActions } from './fixtures';

const testUtils = new AppTestUtils();

// save apps, app actions, and get token
const setUpForAppActions = async (
  app,
  actor: Member,
  creator: Member,
  permission?: PermissionLevel,
) => {
  const values = await testUtils.setUp(app, actor, creator, permission);
  const appActions = await saveAppActions({ item: values.item, member: actor });
  return { ...values, appActions };
};

describe('App Actions Tests', () => {
  let app: FastifyInstance;
  let actor;
  let item, token;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    item = null;
    token = null;
    app.close();
  });

  describe('GET /:itemId/app-action', () => {
    beforeEach(async () => {
      ({ app, actor } = await build());
      ({ item, token } = await setUpForAppActions(app, actor, actor));
    });

    it('Get member in app actions', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${APP_ITEMS_PREFIX}/${item.id}/app-action`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const returnedAppActions = response.json();
      returnedAppActions.forEach((aa) => {
        expect(aa.member.id).toBeDefined();
      });
    });
  });

  describe('POST /:itemId/app-action', () => {
    const payload = { data: { some: 'data' }, type: 'some-type' };

    beforeEach(async () => {
      ({ app, actor } = await build());
      ({ item, token } = await setUpForAppActions(app, actor, actor));
    });

    it('Post app actions successfully', async () => {
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${APP_ITEMS_PREFIX}/${item.id}/app-action`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        payload,
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const newAppAction = response.json();
      expect(newAppAction.member.id).toEqual(actor.id);
    });
  });
});
