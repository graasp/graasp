import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { AppDataVisibility, HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../../test/app';
import { APP_ITEMS_PREFIX } from '../../../../../../utils/config';
import { Actor, Member } from '../../../../../member/entities/member';
import { expectMinimalMember, saveMember } from '../../../../../member/test/fixtures/members';
import { AppTestUtils } from '../../test/fixtures';
import { PreventUpdateAppDataFile } from '../errors';
import { AppDataRepository } from '../repository';
import { saveAppData } from './fixtures';

const testUtils = new AppTestUtils();

const expectAppData = (values, expected) => {
  for (const expectValue of expected) {
    const value = values.find(({ id }) => id === expectValue.id);
    expect(value.type).toEqual(expectValue.type);
    expect(value.data).toEqual(expectValue.data);
  }
};

// save apps, app data, and get token
const setUpForAppData = async (
  app,
  actor: Actor,
  creator: Member,
  permission?: PermissionLevel,
  setPublic?: boolean,
) => {
  const values = await testUtils.setUp(app, actor, creator, permission, setPublic);
  const appData = await saveAppData({
    item: values.item,
    creator: creator ?? actor,
    member: actor ?? creator,
  });
  return { ...values, appData };
};

describe('App Data Tests', () => {
  let app: FastifyInstance;
  let actor;
  let item, token;
  let appData;
  let member;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    member = null;
    item = null;
    token = null;
    appData = null;
    app.close();
  });

  // TODO test different payload
  // TODO: get with many filters
  describe('GET /:itemId/app-data', () => {
    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember();

        ({ item, token, appData } = await setUpForAppData(app, actor, member));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.Get,
          url: '/logout',
        });
      });

      it('Get app data without member and token throws', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Public', () => {
      it('Throws if is signed out', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember();
        ({ item, appData, token } = await setUpForAppData(
          app,
          actor,
          member,
          PermissionLevel.Read,
          true,
        ));
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
        ({ app, actor } = await build());
        const member = await saveMember();
        ({ item, appData, token } = await setUpForAppData(
          app,
          member,
          member,
          PermissionLevel.Read,
          true,
        ));
        const appDataWithItemVisibility = appData.filter(
          ({ visibility }) => visibility === AppDataVisibility.Item,
        );
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
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, appData, token } = await setUpForAppData(app, actor, actor));
      });

      it('Get app data successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectAppData(response.json(), appData);
      });

      it('Get app data by type successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data?type=other-type`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const appDataOfType = appData.filter((d) => d.type === 'other-type');
        const receivedAppData = await response.json();
        expect(appDataOfType.length).toBeGreaterThanOrEqual(1);
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectAppData(appDataOfType, receivedAppData);
        expect(receivedAppData.length).toEqual(appDataOfType.length);
      });

      it('Get empty data for type that does not exist', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data?type=impossible-type`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const appDataOfType = appData.filter((d) => d.type === 'impossible-type');
        const receivedAppData = await response.json();
        expect(appDataOfType.length).toEqual(0);
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectAppData(appDataOfType, receivedAppData);
        expect(receivedAppData.length).toEqual(appDataOfType.length);
      });

      it('Get app data with invalid item id throws', async () => {
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
      beforeEach(async () => {
        ({ app, actor } = await build());
        member = await saveMember();
        ({ item, appData, token } = await setUpForAppData(
          app,
          actor,
          member,
          PermissionLevel.Read,
        ));
      });
      it('Get app data successfully as reader', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectAppData(response.json(), appData);
      });
      it("Get others' app data with visibility item", async () => {
        const otherAppData = await saveAppData({
          item,
          creator: member,
          visibility: AppDataVisibility.Item,
        });
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json()).toHaveLength(appData.length + otherAppData.length);
      });
    });
  });

  describe('GET many /app-data', () => {
    let items;
    let appDataArray;

    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());

        // unefficient way of registering two apps and their app data
        ({ item, token, appData } = await setUpForAppData(app, actor, actor));

        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.Get,
          url: '/logout',
        });
      });

      it('Get many app data without member and token throws', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/app-data?itemId=${item.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    // TODO: public
    // TODO: get with many filters
    describe('Sign In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());

        // unefficient way of registering two apps and their app data
        const { item: item1, appData: appData1 } = await setUpForAppData(app, actor, actor);
        const {
          item: item2,
          token: validToken,
          appData: appData2,
        } = await setUpForAppData(app, actor, actor);
        items = [item1, item2];
        appDataArray = { [item1.id]: appData1, [item2.id]: appData2 };
        token = validToken;
      });

      it('Get many app data successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/app-data?itemId=${items[0].id}&itemId=${items[1].id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        Object.entries(response.json().data).forEach(([itemId, appDatas]) => {
          expectAppData(appDatas, appDataArray[itemId]);
        });
      });

      it('Get many app data with invalid item id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/app-data?itemId=invalid-id`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  // TODO test different payload
  describe('POST /:itemId/app-data', () => {
    const payload = { data: { some: 'data' }, type: 'some-type' };

    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());

        ({ item, token, appData } = await setUpForAppData(app, actor, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.Get,
          url: '/logout',
        });
        member = null;
      });

      it('Post app data without member and token throws', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-data`,
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });

      it('Post app data without type throws', async () => {
        ({ app } = await build({ member: null }));

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
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, token } = await setUpForAppData(app, actor, actor));
      });

      it('Post app data successfully', async () => {
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

        // we don't use the util function because it does not contain an id for iteration
        expect(newAppData.type).toEqual(payload.type);
        expect(newAppData.data).toEqual(payload.data);

        const savedAppData = await AppDataRepository.get(newAppData.id);
        expectAppData([newAppData], [savedAppData]);
      });

      it('Post app data to some member', async () => {
        const bob = await saveMember();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { ...payload, memberId: bob.id },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const newAppData = response.json();

        // we don't use the util function because it does not contain an id for iteration
        expect(newAppData.type).toEqual(payload.type);
        expect(newAppData.data).toEqual(payload.data);
        expectMinimalMember(newAppData.member, bob);
        expectMinimalMember(newAppData.creator, actor);

        const savedAppData = await AppDataRepository.get(newAppData.id);
        expectAppData([newAppData], [savedAppData]);
      });

      it('Invalid item id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: appData,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });

    describe('Sign In with Read permission', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, token } = await setUpForAppData(app, actor, actor, PermissionLevel.Read));
      });

      it('Post app data to some member', async () => {
        const bob = await saveMember();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { ...payload, memberId: bob.id },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const newAppData = response.json();

        // we don't use the util function because it does not contain an id for iteration
        expect(newAppData.type).toEqual(payload.type);
        expect(newAppData.data).toEqual(payload.data);
        expectMinimalMember(newAppData.member, bob);
        expectMinimalMember(newAppData.creator, actor);

        const savedAppData = await AppDataRepository.get(newAppData.id);
        expectAppData([newAppData], [savedAppData]);
      });
    });
  });

  describe('PATCH /:itemId/app-data/:appDataId', () => {
    const updatedData = { data: { myData: 'value' } };
    let chosenAppData;

    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());

        ({ item, token, appData } = await setUpForAppData(app, actor, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.Get,
          url: '/logout',
        });
        member = null;
      });

      it('Request without member and token throws', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-data/${v4()}`,
          payload: { data: updatedData.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Sign In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        let appData;
        ({ item, token, appData } = await setUpForAppData(app, actor, actor));
        chosenAppData = appData[0];
      });

      it('Patch app data successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${chosenAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedData.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json()).toMatchObject(updatedData);
      });

      it('Invalid item id throws bad request', async () => {
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
        const fileAppData = await AppDataRepository.save({
          type: 'type',
          member: actor,
          data: {
            name: 'name',
            type: ItemType.S3_FILE,
            filename: 'filename',
            filepath: 'filepath',
            size: 120,
            mimetype: 'mimetype',
          },
          visibility: AppDataVisibility.Item,
          item: chosenAppData.item,
        });

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${fileAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedData.data },
        });
        expect(response.json()).toMatchObject(new PreventUpdateAppDataFile(fileAppData.id));
      });
    });

    describe('Sign In as reader', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        member = await saveMember();
        let appData;
        ({ item, token, appData } = await setUpForAppData(
          app,
          actor,
          member,
          PermissionLevel.Read,
        ));
        chosenAppData = appData[0];
      });

      it('Can patch own app data', async () => {
        const [a] = await saveAppData({
          item,
          creator: actor,
        });
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${a.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedData.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json()).toMatchObject(updatedData);
      });

      it("Cannot patch someone else's app data", async () => {
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
      beforeEach(async () => {
        ({ app, actor } = await build());

        ({ item, token, appData } = await setUpForAppData(app, actor, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.Get,
          url: '/logout',
        });
        member = null;
      });

      it('Delete app data without member and token throws', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,

          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${v4()}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Sign In', () => {
      let chosenAppData;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, token, appData } = await setUpForAppData(app, actor, actor));
        chosenAppData = appData[0];
      });

      it('Delete app data successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,

          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${chosenAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.body).toEqual(chosenAppData.id);

        const appSetting = await AppDataRepository.findOneBy({ id: chosenAppData.id });
        expect(appSetting).toBeFalsy();
      });

      it('Delete app data with invalid id throws', async () => {
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
