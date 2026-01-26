import { faker } from '@faker-js/faker';
import { and, eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { AppDataVisibility, HttpMethod, ItemType } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { db } from '../../../../../drizzle/db';
import { appDataTable } from '../../../../../drizzle/schema';
import type { AppDataRaw } from '../../../../../drizzle/types';
import { assertIsDefined } from '../../../../../utils/assertions';
import { APP_ITEMS_PREFIX } from '../../../../../utils/config';
import { assertIsMemberForTest } from '../../../../authentication';
import { getAccessToken } from '../test/fixtures';
import { PreventUpdateAppDataFile } from './errors';

jest.retryTimes(3, { logErrorsBeforeRetry: true });

const expectAppDatas = (
  values: Pick<AppDataRaw, 'id' | 'type' | 'data'>[],
  expected: Pick<AppDataRaw, 'id' | 'type' | 'data'>[],
) => {
  for (const expectValue of expected) {
    const value = values.find(({ id }) => id === expectValue.id);
    assertIsDefined(value);
    expect(value.type).toEqual(expectValue.type);
    expect(value.data).toEqual(expectValue.data);
  }
};

function buildAppDataFile() {
  return {
    type: ItemType.FILE,
    data: {
      [ItemType.FILE]: {
        size: faker.number.int({ min: 1, max: 1000 }),
        content: 'content',
        mimetype: 'image/png',
        name: faker.system.fileName(),
        path: faker.system.filePath(),
      },
    },
  };
}

describe('App Data Tests', () => {
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

  // TODO test different payload
  // TODO: get with many filters
  describe('GET /:itemId/app-data', () => {
    describe('Sign Out', () => {
      it('Get app data without member and token throws', async () => {
        const {
          items: [item],
        } = await seedFromJson({ items: [{}] });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Public', () => {
      it('Throws if is signed out', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              isPublic: true,
              type: ItemType.APP,
              appActions: [{ account: { name: 'bob' } }, { account: { name: 'bob' } }],
            },
          ],
        });
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });

      it('Get data with item visibility successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData: appDataWithItemVisibility,
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              type: ItemType.APP,
              appData: [
                { account: 'actor', visibility: AppDataVisibility.Item, creator: 'actor' },
                { account: { name: 'bob' }, visibility: AppDataVisibility.Item, creator: 'actor' },
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
        expect(response.json()).toHaveLength(appDataWithItemVisibility.length);
      });
    });

    describe('Sign In', () => {
      it('Get app data successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: ItemType.APP,
              appData: [
                { account: 'actor', creator: 'actor' },
                { account: 'actor', creator: 'actor' },
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
        expectAppDatas(response.json(), appData);
      });

      it('Get app data by type successfully', async () => {
        const type = 'other-type';
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData: [appData1, appData2],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: ItemType.APP,
              appData: [
                { account: 'actor', type, creator: 'actor' },
                { account: 'actor', type, creator: 'actor' },
                { account: 'actor', creator: 'actor' },
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
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data?type=${type}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const receivedAppData = await response.json();
        const appDataOfType = [appData1, appData2];
        expect(appDataOfType.length).toBeGreaterThanOrEqual(1);
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectAppDatas(appDataOfType, receivedAppData);
        expect(receivedAppData.length).toEqual(appDataOfType.length);
      });

      it('Get empty data for type that does not exist', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: ItemType.APP,
              appData: [{ account: 'actor', creator: 'actor' }],
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
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data?type=impossible-type`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const receivedAppData = await response.json();
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(receivedAppData.length).toEqual(0);
      });

      it('Get app data with invalid item id throws', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });

    describe('Sign in as reader', () => {
      it('Get app data successfully as reader', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: ItemType.APP,
              appData: [
                { account: 'actor', creator: 'actor' },
                { account: 'actor', creator: 'actor' },
                { account: 'actor', creator: 'actor' },
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
        expectAppDatas(response.json(), appData);
      });
      it("Get others' app data with visibility item", async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: ItemType.APP,
              appData: [
                { account: 'actor', creator: 'actor' },
                { account: 'actor', creator: 'actor' },
                { account: 'actor', creator: 'actor', visibility: AppDataVisibility.Item },
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
        expect(response.json()).toHaveLength(appData.length);
      });
    });
  });

  // TODO test different payload
  describe('POST /:itemId/app-data', () => {
    describe('Sign Out', () => {
      it('Post app data without member and token throws', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-data`,
          payload: { data: { some: 'data' }, type: 'some-type' },
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });

      it('Post app data without type throws', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
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
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-data`,
          payload: { data: { some: 'data' } },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });

    describe('Sign In', () => {
      it('Post app data successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              type: ItemType.APP,
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const payload = { data: { some: 'data' }, type: faker.word.sample() };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const savedAppData = await db.query.appDataTable.findFirst({
          where: eq(appDataTable.type, payload.type),
        });
        assertIsDefined(savedAppData);
        expect(savedAppData.data).toEqual(payload.data);
        expect(savedAppData.itemId).toEqual(item.id);
        expectAppDatas([response.json()], [savedAppData]);
      });
      // note: This test is flacky
      it('Post app data to some member', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          members: [bob],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor', permission: 'admin' },
                { account: { name: 'bob' }, permission: 'read' },
              ],
              type: ItemType.APP,
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const payload = { data: { some: 'data' }, type: faker.word.sample() };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { ...payload, accountId: bob.id },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const newAppData = await db.query.appDataTable.findFirst({
          where: and(eq(appDataTable.type, payload.type), eq(appDataTable.accountId, bob.id)),
        });
        assertIsDefined(newAppData);
        expect(newAppData.data).toEqual(payload.data);
        expect(newAppData.accountId).toEqual(bob.id);
        expect(newAppData.creatorId).toEqual(actor.id);
        expectAppDatas([response.json()], [newAppData]);
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
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: { some: 'data' }, type: faker.word.sample() },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
    describe('Sign In with Read permission', () => {
      it('Post app data to some member', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          members: [bob],
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor', permission: 'read' },
                { account: { name: 'bob' }, permission: 'admin' },
              ],
              type: ItemType.APP,
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const payload = { data: { some: 'data' }, type: faker.word.sample() };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { ...payload, accountId: bob.id },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const newAppData = await db.query.appDataTable.findFirst({
          where: eq(appDataTable.type, payload.type),
        });
        assertIsDefined(newAppData);
        expect(newAppData.data).toEqual(payload.data);
        expect(newAppData.accountId).toEqual(bob.id);
        expect(newAppData.creatorId).toEqual(actor.id);
        expectAppDatas([response.json()], [newAppData]);
      });
    });
  });
  describe('PATCH /:itemId/app-data/:appDataId', () => {
    //   const updatedData = { data: { myData: 'value' } };
    it('Request without member and token throws', async () => {
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${APP_ITEMS_PREFIX}/${v4()}/app-data/${v4()}`,
        payload: { data: { myData: 'value' } },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
    describe('Sign In', () => {
      it('Patch app data successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: ItemType.APP,
              appData: [
                { account: 'actor', creator: 'actor', type: 'type', data: { foo: 'value' } },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];
        const chosenAppData = appData[0];
        const updatedData = { data: { foo: 'bar' } };

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${chosenAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: updatedData,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const savedAppData = await db.query.appDataTable.findFirst({
          where: eq(appDataTable.id, chosenAppData.id),
        });
        expect(savedAppData).toMatchObject(updatedData);
        assertIsDefined(savedAppData);
        expectAppDatas([response.json()], [savedAppData]);
      });
      it('Invalid item id throws bad request', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: ItemType.APP,
              appData: [
                { account: 'actor', creator: 'actor', type: 'type', data: { foo: 'value' } },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];
        const chosenAppData = appData[0];
        const updatedData = { data: { foo: 'bar' } };

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-data/${chosenAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedData.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Invalid app data id throws bad request', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: ItemType.APP,
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];
        const updatedData = { data: { foo: 'bar' } };

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/invalid-id`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedData.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Throw if app data is a file', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData: [fileAppData],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: ItemType.APP,
              appData: [{ account: 'actor', creator: 'actor', ...buildAppDataFile() }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const updatedData = { data: { foo: 'bar' } };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${fileAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedData.data },
        });
        expect(response.json()).toMatchObject(new PreventUpdateAppDataFile(fileAppData.id));
        const savedAppData = await db.query.appDataTable.findFirst({
          where: eq(appDataTable.id, fileAppData.id),
        });
        expect(savedAppData).toMatchObject(fileAppData);
      });
    });
    describe('Sign In as reader', () => {
      it('Can patch own app data', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData: [a],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: ItemType.APP,
              appData: [{ account: 'actor', creator: 'actor', type: 'type', data: { foo: 'bar' } }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const updatedData = { data: { foo: 'bar' } };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${a.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedData.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const savedAppData = await db.query.appDataTable.findFirst({
          where: eq(appDataTable.id, a.id),
        });
        assertIsDefined(savedAppData);
        expect(savedAppData).toMatchObject(updatedData);
        expectAppDatas([response.json()], [savedAppData]);
      });
      it("Cannot patch someone else's app data", async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData: [chosenAppData],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: ItemType.APP,
              appData: [
                {
                  account: { name: 'bob' },
                  creator: { name: 'bob' },
                  type: 'type',
                  data: { foo: 'bar' },
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const updatedData = { data: { newFoo: 'barbar' } };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${chosenAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedData.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      });
    });
  });
  describe('DELETE /:itemId/app-data/:appDataId', () => {
    describe('Sign Out', () => {
      it('Delete app data without member and token throws', async () => {
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
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${v4()}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });
    describe('Sign In', () => {
      it('Delete app data successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData: [chosenAppData],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: ItemType.APP,
              appData: [
                {
                  account: { name: 'bob' },
                  creator: { name: 'bob' },
                  type: 'type',
                  data: { foo: 'bar' },
                },
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
          method: HttpMethod.Delete,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${chosenAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.body).toEqual(chosenAppData.id);
        const appData = await db.query.appDataTable.findFirst({
          where: eq(appDataTable.id, chosenAppData.id),
        });
        expect(appData).toBeFalsy();
      });
      it('Delete app data with invalid id throws', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
          appData: [chosenAppData],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: ItemType.APP,
              appData: [
                {
                  account: { name: 'bob' },
                  creator: { name: 'bob' },
                  type: 'type',
                  data: { foo: 'bar' },
                },
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
          method: HttpMethod.Delete,
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-data/${chosenAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Delete app data with invalid app data id throws', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
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
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/invalid-id`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
