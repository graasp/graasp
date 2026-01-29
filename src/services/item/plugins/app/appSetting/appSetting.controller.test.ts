import { and, eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { db } from '../../../../../drizzle/db';
import { isDirectChild } from '../../../../../drizzle/operations';
import { appSettingsTable, itemsRawTable } from '../../../../../drizzle/schema';
import type { AppSettingRaw } from '../../../../../drizzle/types';
import { assertIsDefined } from '../../../../../utils/assertions';
import { APP_ITEMS_PREFIX } from '../../../../../utils/config';
import { MemberCannotAdminItem } from '../../../../../utils/errors';
import { assertIsMemberForTest } from '../../../../authentication';
import { getAccessToken } from '../test/fixtures';

/**
 * Check that `expected` is contained in `values`
 * Does not check that they match exactly !
 * @param values values returned by the API
 * @param expected expected values
 */
const expectAppSettings = (
  values: Pick<AppSettingRaw, 'id' | 'name' | 'data'>[],
  expected: Pick<AppSettingRaw, 'id' | 'name' | 'data'>[],
) => {
  for (const expectValue of expected) {
    const value = values.find(({ id }) => id === expectValue.id);
    assertIsDefined(value);
    expect(value.name).toEqual(expectValue.name);
    expect(value.data).toEqual(expectValue.data);
  }
};

describe('Apps Settings Tests', () => {
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

  describe('GET /:itemId/app-settings', () => {
    describe('Sign Out', () => {
      it('Get app setting throws without token', async () => {
        const {
          items: [item],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              type: 'app',
            },
          ],
        });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });

      it('Get app setting for public item', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          appSettings,
        } = await seedFromJson({
          actor: null,
          items: [
            {
              isPublic: true,
              type: 'app',
              appSettings: [{ creator: { name: 'bob' } }, { creator: { name: 'alice' } }],
            },
          ],
        });
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectAppSettings(response.json(), appSettings);
      });
    });

    describe('Sign In', () => {
      it('Get app setting without token throws', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              type: 'app',
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });

      it('Get app settings successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appSettings,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor', permission: 'admin' }],
              appSettings: [{ creator: { name: 'bob' } }, { creator: { name: 'alice' } }],
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
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectAppSettings(response.json(), appSettings);
      });

      it('Get named app setting successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appSettings: [appSetting1, appSetting2],
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor', permission: 'admin' }],
              appSettings: [
                { creator: { name: 'bob' }, name: 'new-setting' },
                { creator: { name: 'bob' }, name: 'new-setting' },
                { creator: { name: 'alice' } },
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
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings?name=new-setting`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectAppSettings(response.json(), [appSetting1, appSetting2]);
      });

      it('Get unexisting named app setting successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appSettings,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
              appSettings: [
                { creator: { name: 'bob' } },
                { creator: { name: 'bob' } },
                { creator: { name: 'alice' } },
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
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings?name=no-setting`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const res = await response.json();
        const expectedData = appSettings.filter((s) => s.name === 'no-setting');
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(res.length).toEqual(expectedData.length);
        expectAppSettings(res, expectedData);
      });

      it('Get app setting with invalid item id throws', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
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
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('POST /:itemId/app-settings', () => {
    describe('Sign Out', () => {
      it('Post app setting without member and token throws', async () => {
        await seedFromJson({
          actor: null,
          items: [
            {
              type: 'app',
            },
          ],
        });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-settings`,
          payload: { name: 'my-name', data: { some: 'data' } },
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });
    describe('Sign In', () => {
      it('Post app setting successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const appSetting = { name: 'my-name', data: { some: 'data' } };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: appSetting,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const newAppSetting = response.json();
        expect(newAppSetting.name).toEqual(appSetting.name);
        expect(newAppSetting.data).toEqual(appSetting.data);
        const savedAppSetting = await db.query.appSettingsTable.findFirst({
          where: eq(appSettingsTable.id, newAppSetting.id),
        });
        assertIsDefined(savedAppSetting);
        expectAppSettings([newAppSetting], [savedAppSetting]);
      });
      it('Post app setting throws for read membership', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: 'app',
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const appSetting = { name: 'my-name', data: { some: 'data' } };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: appSetting,
        });
        expect(response.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });
      it('Post app setting throws for write membership', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'write' }],
              type: 'app',
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const appSetting = { name: 'my-name', data: { some: 'data' } };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: appSetting,
        });
        expect(response.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });
      it('Invalid item id throws', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const appSetting = { name: 'my-name', data: { some: 'data' } };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: appSetting,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });
  describe('PATCH /:itemId/app-settings/:appSettingId', () => {
    describe('Sign Out', () => {
      it('Request without member and token throws', async () => {
        const response = await app.inject({
          method: 'PATCH',
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-settings/${v4()}`,
          payload: { name: 'my-name', data: { some: 'data' } },
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });
    describe('Sign In', () => {
      it('Patch app settings successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appSettings: [chosenAppSetting],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
              appSettings: [{ creator: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const updatedSetting = { data: { some: 'data' } };
        const response = await app.inject({
          method: 'PATCH',
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/${chosenAppSetting.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedSetting.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json()).toMatchObject(updatedSetting);
      });
      it('Patch app setting throws for read membership', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appSettings: [chosenAppSetting],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: 'app',
              appSettings: [{ creator: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const updatedSetting = { data: { some: 'data' } };
        const response = await app.inject({
          method: 'PATCH',
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/${chosenAppSetting.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedSetting.data },
        });
        expect(response.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });
      it('Patch app setting throws for write membership', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appSettings: [chosenAppSetting],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'write' }],
              type: 'app',
              appSettings: [{ creator: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const updatedSetting = { data: { some: 'data' } };
        const response = await app.inject({
          method: 'PATCH',
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/${chosenAppSetting.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedSetting.data },
        });
        expect(response.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });
      it('Invalid item id throws bad request', async () => {
        const {
          actor,
          appSettings: [chosenAppSetting],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
              appSettings: [{ creator: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const updatedSetting = { data: { some: 'data' } };
        const response = await app.inject({
          method: 'PATCH',
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-settings/${chosenAppSetting.id}`,
          payload: { data: updatedSetting.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Invalid app setting id throws bad request', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const updatedSetting = { data: { some: 'data' } };
        const response = await app.inject({
          method: 'PATCH',
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/invalid-id`,
          payload: { data: updatedSetting.data },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });
  describe('DELETE /:itemId/app-settings/:appSettingId', () => {
    describe('Sign Out', () => {
      it('Delete app setting without member and token throws', async () => {
        const {
          items: [item],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              type: 'app',
            },
          ],
        });

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/${v4()}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });
    describe('Sign In', () => {
      it('Delete app setting successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appSettings: [chosenAppSetting],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
              appSettings: [{ creator: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/${chosenAppSetting.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const appSetting = await db.query.appSettingsTable.findFirst({
          where: eq(appSettingsTable.id, chosenAppSetting.id),
        });
        expect(appSetting).toBeUndefined();
      });
      it('Delete app setting with invalid id throws', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appSettings: [chosenAppSetting],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
              appSettings: [{ creator: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-settings/${chosenAppSetting.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Delete app setting with invalid app setting id throws', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: 'app',
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/invalid-id`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Delete app setting throws for read membership', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appSettings: [chosenAppSetting],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: 'app',
              appSettings: [{ creator: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/${chosenAppSetting.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });
      it('Delete app setting throws for write membership', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appSettings: [chosenAppSetting],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'write' }],
              type: 'app',
              appSettings: [{ creator: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/${chosenAppSetting.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });
    });
  });
  describe('hooks', () => {
    it('copies app settings on item copy', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'read' }],
            type: 'app',
            appSettings: [{ creator: 'actor' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // copy item
      const response = await app.inject({
        method: 'POST',
        url: '/api/items/copy',
        query: {
          id: [item.id],
        },
        payload: {},
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const itemInDb = await db.query.itemsRawTable.findMany({
          where: eq(itemsRawTable.name, item.name),
        });
        expect(itemInDb).toHaveLength(1);
        const appSettings = await db.query.appSettingsTable.findMany({
          where: eq(appSettingsTable.itemId, itemInDb[0].id),
        });
        expect(appSettings).toHaveLength(1);

        // copied app has copied settings
        const copyInDb = await db.query.itemsRawTable.findMany({
          where: eq(itemsRawTable.name, `${item.name} (2)`),
        });
        expect(copyInDb).toHaveLength(1);
        const copiedAppSettings = await db.query.appSettingsTable.findMany({
          where: eq(appSettingsTable.itemId, copyInDb[0].id),
        });
        expect(copiedAppSettings).toHaveLength(1);
      }, 5000);
    });
    it('copies app settings on parent item copy', async () => {
      const {
        actor,
        items: [parent, appItem],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'read' }],
            children: [
              {
                type: 'app',
                appSettings: [{ creator: 'actor' }],
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // copy parent
      const response = await app.inject({
        method: 'POST',
        url: '/api/items/copy',
        query: {
          id: [parent.id],
        },
        payload: {},
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const copiedParent = await db.query.itemsRawTable.findMany({
          where: eq(itemsRawTable.name, `${parent.name} (2)`),
        });
        expect(copiedParent).toHaveLength(1);

        // copied app has copied settings
        const copyInDb = await db.query.itemsRawTable.findMany({
          where: and(
            eq(itemsRawTable.name, appItem.name),
            isDirectChild(itemsRawTable.path, copiedParent[0].path),
          ),
        });
        expect(copyInDb).toHaveLength(1);
        const copiedAppSettings = await db.query.appSettingsTable.findMany({
          where: eq(appSettingsTable.itemId, copyInDb[0].id),
        });
        expect(copiedAppSettings).toHaveLength(1);
      }, 5000);
    });
  });
});
