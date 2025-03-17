import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../../test/app';
import { seedFromJson } from '../../../../../../../test/mocks/seed';
import { db } from '../../../../../../drizzle/db';
import { appSettings } from '../../../../../../drizzle/schema';
import { assertIsDefined } from '../../../../../../utils/assertions';
import { APP_ITEMS_PREFIX } from '../../../../../../utils/config';
import { MemberCannotAdminItem } from '../../../../../../utils/errors';
import { assertIsMemberForTest } from '../../../../../authentication';
import { getAccessToken } from '../../test/fixtures';

/**
 * Check that `expected` is contained in `values`
 * Does not check that they match exactly !
 * @param values values returned by the API
 * @param expected expected values
 */
const expectAppSettings = (values, expected) => {
  for (const expectValue of expected) {
    const value = values.find(({ id }) => id === expectValue.id);
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
              type: ItemType.APP,
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
              type: ItemType.APP,
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
              type: ItemType.APP,
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
              type: ItemType.APP,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
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
              type: ItemType.APP,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
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
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
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
        const savedAppSetting = await db.query.appSettings.findFirst({
          where: eq(appSettings.id, newAppSetting.id),
        });
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
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
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
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
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        const appSetting = await db.query.appSettings.findFirst({
          where: eq(appSettings.id, chosenAppSetting.id),
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
              type: ItemType.APP,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              type: ItemType.APP,
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
});
