/**
 * These tests make sure we keep legacy properties to ensure compatibility with old apps
 * We continue to send "member" for legacy apps
 */
import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../../test/app';
import { seedFromJson } from '../../../../../../../test/mocks/seed';
import { db } from '../../../../../../drizzle/db';
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
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            type: ItemType.APP,
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
      response.json().forEach((ad) => {
        expect(ad.member).toBeDefined();
      });
    });
  });
});
