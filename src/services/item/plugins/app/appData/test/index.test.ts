import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { AppDataVisibility, HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../../test/app';
import { seedFromJson } from '../../../../../../../test/mocks/seed';
import { db } from '../../../../../../drizzle/db';
import { appDatas } from '../../../../../../drizzle/schema';
import { assertIsDefined } from '../../../../../../utils/assertions';
import { APP_ITEMS_PREFIX } from '../../../../../../utils/config';
import { assertIsMemberForTest } from '../../../../../authentication';
import { expectAccount } from '../../../../../member/test/fixtures/members';
import { getAccessToken } from '../../test/fixtures';
import { PreventUpdateAppDataFile } from '../errors';
import { saveAppData } from './fixtures';

const expectAppDatas = (values, expected) => {
  for (const expectValue of expected) {
    const value = values.find(({ id }) => id === expectValue.id);
    expect(value.type).toEqual(expectValue.type);
    expect(value.data).toEqual(expectValue.data);
  }
};

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
                { account: { name: 'bob' }, visibility: AppDataVisibility.Item },
                { account: { name: 'bob' }, visibility: AppDataVisibility.Item },
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
              appData: [{ account: 'actor' }, { account: 'actor' }],
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
              appData: [
                { account: 'actor', type },
                { account: 'actor', type },
                { account: 'actor' },
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.APP,
              appData: [{ account: 'actor' }],
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
              type: ItemType.APP,
              appData: [{ account: 'actor' }, { account: 'actor' }, { account: 'actor' }],
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
              type: ItemType.APP,
              appData: [
                { account: 'actor' },
                { account: 'actor' },
                { account: 'actor', visibility: AppDataVisibility.Item },
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
    // });

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
          const payload = { data: { some: 'data' }, type: faker.word.sample() };
          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
            headers: {
              Authorization: `Bearer ${token}`,
            },
            payload,
          });
          expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
          const savedAppData = await db.query.appDatas.findFirst({
            where: eq(appDatas.type, payload.type),
          });
          assertIsDefined(savedAppData);
          expect(savedAppData.data).toEqual(payload.data);
          expect(savedAppData.itemId).toEqual(item.id);
        });
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
                  { account: 'actor', permission: PermissionLevel.Admin },
                  { account: { name: 'bob' }, permission: PermissionLevel.Admin },
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
          expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
          const newAppData = await db.query.appDatas.findFirst({
            where: eq(appDatas.type, payload.type),
          });
          assertIsDefined(newAppData);
          expect(newAppData.data).toEqual(payload.data);
          expect(newAppData.accountId).toEqual(bob.id);
          expect(newAppData.creatorId).toEqual(actor.id);
        });
        it('Invalid item id throws', async () => {
          const { apps } = await seedFromJson({ apps: [{}] });
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [
              {
                memberships: [
                  { account: 'actor', permission: PermissionLevel.Admin },
                  { account: { name: 'bob' }, permission: PermissionLevel.Admin },
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
                  { account: 'actor', permission: PermissionLevel.Read },
                  { account: { name: 'bob' }, permission: PermissionLevel.Admin },
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
          expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
          const newAppData = await db.query.appDatas.findFirst({
            where: eq(appDatas.type, payload.type),
          });
          assertIsDefined(newAppData);
          expect(newAppData.data).toEqual(payload.data);
          expect(newAppData.accountId).toEqual(bob.id);
          expect(newAppData.creatorId).toEqual(actor.id);
        });
      });
    });
    describe('PATCH /:itemId/app-data/:appDataId', () => {
      //   const updatedData = { data: { myData: 'value' } };
      //   let chosenAppData;
      describe('Sign Out', () => {
        //     beforeEach(async () => {
        //       ({ app, actor } = await build());
        //       ({ item, token, appData } = await setUpForAppData(app, actor, actor));
        //       // logout after getting token and setting up
        //       await app.inject({
        //         method: HttpMethod.Get,
        //         url: '/logout',
        //       });
        //       member = null;
        //     });
        //     it('Request without member and token throws', async () => {
        //       const response = await app.inject({
        //         method: HttpMethod.Patch,
        //         url: `${APP_ITEMS_PREFIX}/${v4()}/app-data/${v4()}`,
        //         payload: { data: updatedData.data },
        //       });
        //       expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
        //     });
        //   });
        //   describe('Sign In', () => {
        //     beforeEach(async () => {
        //       ({ app, actor } = await build());
        //       let appData;
        //       ({ item, token, appData } = await setUpForAppData(app, actor, actor));
        //       chosenAppData = appData[0];
        //     });
        //     it('Patch app data successfully', async () => {
        //       const response = await app.inject({
        //         method: HttpMethod.Patch,
        //         url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${chosenAppData.id}`,
        //         headers: {
        //           Authorization: `Bearer ${token}`,
        //         },
        //         payload: { data: updatedData.data },
        //       });
        //       expect(response.statusCode).toEqual(StatusCodes.OK);
        //       expect(response.json()).toMatchObject(updatedData);
        //     });
        //     it('Invalid item id throws bad request', async () => {
        //       const response = await app.inject({
        //         method: HttpMethod.Patch,
        //         url: `${APP_ITEMS_PREFIX}/invalid-id/app-data/${chosenAppData.id}`,
        //         headers: {
        //           Authorization: `Bearer ${token}`,
        //         },
        //         payload: { data: updatedData.data },
        //       });
        //       expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        //     });
        //     it('Invalid app data id throws bad request', async () => {
        //       const response = await app.inject({
        //         method: HttpMethod.Patch,
        //         url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/invalid-id`,
        //         headers: {
        //           Authorization: `Bearer ${token}`,
        //         },
        //         payload: { data: updatedData.data },
        //       });
        //       expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        //     });
        //     it('Throw if app data is a file', async () => {
        //       const fileAppData = await AppDataSource.getRepository(AppData).save({
        //         type: 'type',
        //         account: actor,
        //         data: {
        //           name: 'name',
        //           type: ItemType.S3_FILE,
        //           filename: 'filename',
        //           filepath: 'filepath',
        //           size: 120,
        //           mimetype: 'mimetype',
        //         },
        //         visibility: AppDataVisibility.Item,
        //         item: chosenAppData.item,
        //       });
        //       const response = await app.inject({
        //         method: HttpMethod.Patch,
        //         url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${fileAppData.id}`,
        //         headers: {
        //           Authorization: `Bearer ${token}`,
        //         },
        //         payload: { data: updatedData.data },
        //       });
        //       expect(response.json()).toMatchObject(new PreventUpdateAppDataFile(fileAppData.id));
        //     });
        //   });
        //   describe('Sign In as reader', () => {
        //     beforeEach(async () => {
        //       ({ app, actor } = await build());
        //       member = await saveMember();
        //       let appData;
        //       ({ item, token, appData } = await setUpForAppData(
        //         app,
        //         actor,
        //         member,
        //         PermissionLevel.Read,
        //       ));
        //       chosenAppData = appData[0];
        //     });
        //     it('Can patch own app data', async () => {
        //       const [a] = await saveAppData({
        //         item,
        //         creator: actor,
        //       });
        //       const response = await app.inject({
        //         method: HttpMethod.Patch,
        //         url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${a.id}`,
        //         headers: {
        //           Authorization: `Bearer ${token}`,
        //         },
        //         payload: { data: updatedData.data },
        //       });
        //       expect(response.statusCode).toEqual(StatusCodes.OK);
        //       expect(response.json()).toMatchObject(updatedData);
        //     });
        //     it("Cannot patch someone else's app data", async () => {
        //       const response = await app.inject({
        //         method: HttpMethod.Patch,
        //         url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${chosenAppData.id}`,
        //         headers: {
        //           Authorization: `Bearer ${token}`,
        //         },
        //         payload: { data: updatedData.data },
        //       });
        //       expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        //     });
        //   });
        // });
        // describe('DELETE /:itemId/app-data/:appDataId', () => {
        //   describe('Sign Out', () => {
        //     beforeEach(async () => {
        //       ({ app, actor } = await build());
        //       ({ item, token, appData } = await setUpForAppData(app, actor, actor));
        //       // logout after getting token and setting up
        //       await app.inject({
        //         method: HttpMethod.Get,
        //         url: '/logout',
        //       });
        //       member = null;
        //     });
        //     it('Delete app data without member and token throws', async () => {
        //       const response = await app.inject({
        //         method: HttpMethod.Delete,
        //         url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${v4()}`,
        //       });
        //       expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
        //     });
        //   });
        //   describe('Sign In', () => {
        //     let chosenAppData;
        //     beforeEach(async () => {
        //       ({ app, actor } = await build());
        //       ({ item, token, appData } = await setUpForAppData(app, actor, actor));
        //       chosenAppData = appData[0];
        //     });
        //     it('Delete app data successfully', async () => {
        //       const response = await app.inject({
        //         method: HttpMethod.Delete,
        //         url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${chosenAppData.id}`,
        //         headers: {
        //           Authorization: `Bearer ${token}`,
        //         },
        //       });
        //       expect(response.statusCode).toEqual(StatusCodes.OK);
        //       expect(response.body).toEqual(chosenAppData.id);
        //       const appSetting = await AppDataSource.getRepository(AppData).findOneBy({
        //         id: chosenAppData.id,
        //       });
        //       expect(appSetting).toBeFalsy();
        //     });
        //     it('Delete app data with invalid id throws', async () => {
        //       const response = await app.inject({
        //         method: HttpMethod.Delete,
        //         url: `${APP_ITEMS_PREFIX}/invalid-id/app-data/${chosenAppData.id}`,
        //         headers: {
        //           Authorization: `Bearer ${token}`,
        //         },
        //       });
        //       expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        //     });
        //     it('Delete app data with invalid app data id throws', async () => {
        //       const response = await app.inject({
        //         method: HttpMethod.Delete,
        //         url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/invalid-id`,
        //         headers: {
        //           Authorization: `Bearer ${token}`,
        //         },
        //       });
        //       expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
