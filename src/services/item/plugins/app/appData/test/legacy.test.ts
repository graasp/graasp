/**
 * These tests make sure we keep legacy properties to ensure compatibility with old apps
 * We continue to send "member" for legacy apps
 */
import { StatusCodes } from 'http-status-codes';

import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../../test/app';
import { seedFromJson } from '../../../../../../../test/mocks/seed';
import { db } from '../../../../../../drizzle/db';
import type { AccountRaw } from '../../../../../../drizzle/types';
import { assertIsDefined } from '../../../../../../utils/assertions';
import { APP_ITEMS_PREFIX } from '../../../../../../utils/config';
import { assertIsMemberForTest } from '../../../../../authentication';
import { getAccessToken } from '../../test/fixtures';

describe('App Data Tests - Legacy', () => {
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

  describe('GET /:itemId/app-data', () => {
    it('Get member in app data', async () => {
      const { apps } = await seedFromJson({ apps: [{}] });
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
            type: 'app',
            appData: [
              { account: 'actor', creator: 'actor' },
              { account: 'actor', creator: 'actor' },
              { account: { name: 'bob' }, creator: 'actor' },
              { account: { name: 'bob' }, creator: 'actor' },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);
      const chosenApp = apps[0];

      const token = await getAccessToken(app, item, chosenApp);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      response.json<{ member: AccountRaw }[]>().forEach((ad) => {
        expect(ad.member).toBeDefined();
      });
    });
  });
  describe('POST /:itemId/app-data', () => {
    it('Post app data to some memberId, and return member', async () => {
      const { apps } = await seedFromJson({ apps: [{}] });
      const {
        actor,
        items: [item],
        members: [bob],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
            type: 'app',
            appData: [{ account: { name: 'bob' }, creator: 'actor' }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);
      const chosenApp = apps[0];

      const token = await getAccessToken(app, item, chosenApp);
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
    it('Return member in patched app data', async () => {
      const { apps } = await seedFromJson({ apps: [{}] });
      const {
        actor,
        items: [item],
        appData: [chosenAppData],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
            type: 'app',
            appData: [{ account: 'actor', creator: 'actor' }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);
      const chosenApp = apps[0];

      const token = await getAccessToken(app, item, chosenApp);
      const updatedData = { data: { myData: 'value' } };
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
