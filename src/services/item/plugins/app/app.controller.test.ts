import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { appsTable } from '../../../../drizzle/schema';
import type { AccountRaw, AppRaw, ItemWithCreator } from '../../../../drizzle/types';
import { assertIsDefined } from '../../../../utils/assertions';
import { APP_ITEMS_PREFIX } from '../../../../utils/config';
import { assertIsMemberForTest } from '../../../authentication';
import { expectItem } from '../../test/fixtures/items';
import { getAccessToken } from './test/fixtures';

describe('Apps Plugin Tests', () => {
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

  describe('GET /list', () => {
    it('Get apps list', async () => {
      const { apps } = await seedFromJson({ apps: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${APP_ITEMS_PREFIX}/list`,
      });
      const data = response.json<AppRaw[]>();
      const appValue = data.find((a) => a.name === apps[0].name);
      assertIsDefined(appValue);
      expect(appValue.url).toEqual(apps[0].url);
      expect(appValue.id).toBeFalsy();
    });
  });

  describe('GET /most-used/', () => {
    it('should throw an error if member is not authenticated', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${APP_ITEMS_PREFIX}/most-used`,
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
    it('should return the most used apps for a valid member', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${APP_ITEMS_PREFIX}/most-used`,
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
    });
  });

  describe('POST /:itemId/api-access-token', () => {
    describe('Signed Out', () => {
      it('Unauthenticated member throws error', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
        } = await seedFromJson({ items: [{ type: 'app' }] });
        const chosenApp = apps[0];

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: chosenApp.url, key: chosenApp.key },
        });
        // the call should fail: suppose authentication works correctly and throws

        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      });
    });

    describe('Public', () => {
      it('Successfully request api access', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          items: [item],
        } = await seedFromJson({
          items: [{ isPublic: true, type: 'app', extra: { app: { url: chosenApp.url } } }],
        });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: chosenApp.url, key: chosenApp.key },
        });
        expect(response.json().token).toBeTruthy();
      });

      it('validation of payload', async () => {
        // remove apps that have been registered with this URL
        const url = 'http://localhost:3333';
        await db.delete(appsTable).where(eq(appsTable.url, url));
        const { apps } = await seedFromJson({ apps: [{ url }] });
        const chosenApp = apps[0];
        const {
          items: [item],
        } = await seedFromJson({
          items: [{ isPublic: true, type: 'app', extra: { app: { url: chosenApp.url } } }],
        });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: chosenApp.url, key: chosenApp.key },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json().token).toBeTruthy();
      });
    });

    describe('Signed In', () => {
      it('Request api access', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
              extra: { app: { url: chosenApp.url } },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: chosenApp.url, key: chosenApp.key },
        });
        expect(response.json().token).toBeTruthy();
      });

      it('Incorrect params throw bad request', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
              extra: { app: { url: chosenApp.url } },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: faker.internet.url() },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);

        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { key: v4() },
        });
        expect(response1.statusCode).toEqual(StatusCodes.BAD_REQUEST);

        const response2 = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/unknown/api-access-token`,
          payload: { key: v4() },
        });
        expect(response2.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Unauthorized if actor does not have membership on the app item', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              extra: { app: { url: chosenApp.url } },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: chosenApp.url, key: chosenApp.key },
        });

        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      });
    });
  });

  describe('GET /:itemId/context', () => {
    describe('Public', () => {
      it('Get app context successfully for one item without members', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          items: [item],
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              type: 'app',
              extra: { app: { url: chosenApp.url } },
            },
          ],
        });
        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        const data = response.json();
        expect(data.item.id).toEqual(item.id);
        expect(data.members).toHaveLength(0);
      });
    });
    describe('Signed Out', () => {
      it('Request without token and without member throws', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          items: [item],
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              extra: { app: { url: chosenApp.url } },
            },
          ],
        });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });
    describe('Signed In', () => {
      it('Get app context successfully for one item', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          actor,
          members: [bob],
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor', permission: 'read' },
                { account: { name: 'bob' }, permission: 'read' },
              ],
              type: 'app',
              extra: { app: { url: chosenApp.url } },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = response.json<{ item: ItemWithCreator; members: AccountRaw[] }>();

        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(data.item.id).toEqual(item.id);
        expect(data.members).toHaveLength(2);
        const membersId = data.members.map((i) => i.id);
        expect(membersId).toContain(actor.id);
        expect(membersId).toContain(bob.id);
      });
      it('Get app context successfully for one item as guest', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          guests: [bob],
          members: [anna],
          items: [item],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              memberships: [{ account: { name: 'anna' }, permission: 'read' }],
              type: 'app',
              extra: { app: { url: chosenApp.url } },
              itemLoginSchema: { guests: [{}] },
            },
          ],
        });
        // authenticate as bob
        mockAuthenticate(bob);

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const data = response.json<{ item: ItemWithCreator; members: AccountRaw[] }>();
        expect(data.item.id).toEqual(item.id);
        expect(data.members).toHaveLength(2);
        const membersId = data.members.map((i) => i.id);
        expect(membersId).toContain(anna.id);
        expect(membersId).toContain(bob.id);
      });
      it('Get app context successfully for one item and its private parent', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          actor,
          items: [_parentItem, item],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor', permission: 'read' },
                { account: { name: 'bob' }, permission: 'read' },
              ],
              children: [
                {
                  type: 'app',
                  extra: { app: { url: chosenApp.url } },
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const result = response.json<{ item: ItemWithCreator; members: AccountRaw[] }>();
        const { members, item: resultItem } = result;
        expectItem(resultItem, item);
        expect(members).toHaveLength(2);
        const membersId = result.members.map((i) => i.id);
        expect(membersId).toContain(actor.id);
      });
      it('Get app context successfully for one item and its public parent', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          actor,
          items: [_parentItem, item],
          members: membersWithMembership,
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              memberships: [{ account: { name: 'bob' } }, { account: { name: 'anna' } }],
              children: [
                {
                  type: 'app',
                  extra: { app: { url: chosenApp.url } },
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const result = response.json<{ item: ItemWithCreator; members: AccountRaw[] }>();
        const { members, item: resultItem } = result;
        expectItem(resultItem, item);
        expect(members).toHaveLength(2);
        const membersId = result.members.map((i) => i.id);
        expect(membersId).toContain(membersWithMembership[0].id);
        expect(membersId).toContain(membersWithMembership[1].id);
      });
      it('Invalid item id throws bad request', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/invalid-id/context`,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
