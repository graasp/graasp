/**
 * These tests make sure we keep legacy properties to ensure compatibility with old apps
 * We continue to send "member" for legacy apps
 */
import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../../test/app';
import { AuthenticatedUser, MinimalMember } from '../../../../../../types';
import { APP_ITEMS_PREFIX } from '../../../../../../utils/config';
import { saveMember } from '../../../../../member/test/fixtures/members';
import { AppTestUtils } from '../../test/fixtures';
import { saveAppData } from './fixtures';

const testUtils = new AppTestUtils();

// save apps, app data, and get token
const setUpForAppData = async (
  app,
  actor: AuthenticatedUser,
  creator: MinimalMember,
  permission?: PermissionLevel,
  setPublic?: boolean,
) => {
  const values = await testUtils.setUp(app, actor, creator, permission, setPublic);
  const appData = await saveAppData({
    item: values.item,
    creator: creator ?? actor,
    account: actor ?? creator,
  });
  return { ...values, appData };
};

describe('App Data Tests - Legacy', () => {
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

  describe('GET /:itemId/app-data', () => {
    beforeEach(async () => {
      ({ app, actor } = await build());
      ({ item, token } = await setUpForAppData(app, actor, actor));
    });

    it('Get member in app data', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      response.json().forEach((ad) => {
        expect(ad.member).toBeDefined();
      });
    });
  });

  describe('POST /:itemId/app-data', () => {
    beforeEach(async () => {
      ({ app, actor } = await build());
      ({ item, token } = await setUpForAppData(app, actor, actor));
    });

    it('Post app data to some memberId, and return member', async () => {
      const bob = await saveMember();
      const payload = { data: { some: 'data' }, type: 'some-type', memberId: bob.id };
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        payload,
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const newAppData = response.json();

      expect(newAppData.member.id).toEqual(bob.id);
    });
  });

  describe('PATCH /:itemId/app-data/:appDataId', () => {
    const updatedData = { data: { myData: 'value' } };
    let chosenAppData;

    beforeEach(async () => {
      ({ app, actor } = await build());
      let appData;
      ({ item, token, appData } = await setUpForAppData(app, actor, actor));
      chosenAppData = appData[0];
    });

    it('Return member in patched app data', async () => {
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${chosenAppData.id}`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        payload: { data: updatedData.data },
      });
      expect(response.json().member.id).toBeDefined();
    });
  });
});
