import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../../test/app';
import { APP_ITEMS_PREFIX } from '../../../../../../util/config';
import { Member } from '../../../../../member/entities/member';
import { Item } from '../../../../entities/Item';
import { AppDataVisibility } from '../../interfaces/app-details';
import { setUp } from '../../test/fixtures';
import { AppDataRepository } from '../repository';

// mock datasource
jest.mock('../../../../../../plugins/datasource');

const expectAppData = (values, expected) => {
  for (const expectValue of expected) {
    const value = values.find(({ id }) => id === expectValue.id);
    expect(value.type).toEqual(expectValue.type);
    expect(value.data).toEqual(expectValue.data);
  }
};

const saveAppData = async ({
  item,
  creator,
  member,
}: {
  item: Item;
  creator: Member;
  member?: Member;
}) => {
  const defaultData = { type: 'some-type', data: { some: 'data' } };
  const s1 = await AppDataRepository.save({
    item,
    creator,
    member: member ?? creator,
    ...defaultData,
    visibility: AppDataVisibility.ITEM,
  });
  const s2 = await AppDataRepository.save({
    item,
    creator,
    member: member ?? creator,
    ...defaultData,
    visibility: AppDataVisibility.ITEM,
  });
  const s3 = await AppDataRepository.save({
    item,
    creator,
    member: member ?? creator,
    ...defaultData,
    visibility: AppDataVisibility.MEMBER,
  });
  return [s1, s2, s3];
};

// save apps, app data, and get token
const setUpForAppData = async (
  app,
  actor: Member,
  creator?: Member,
  permission?: PermissionLevel,
) => {
  const values = await setUp(app, actor, creator, permission);
  const appData = await saveAppData({ item: values.item, creator: creator ?? actor });
  return { ...values, appData };
};

describe('Apps Data Tests', () => {
  let app;
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
        ({ app, actor } = await build());

        ({ item, token, appData } = await setUpForAppData(app, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.GET,
          url: '/logout',
        });
      });

      it('Get app data without member and token throws', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    // TODO: public

    describe('Sign In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, appData, token } = await setUpForAppData(app, actor));
      });

      it('Get app data successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectAppData(response.json(), appData);
      });

      it('Get app data with invalid item id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
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
        ({ item, token, appData } = await setUpForAppData(app, actor));

        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.GET,
          url: '/logout',
        });
      });

      it('Get many app data without member and token throws', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
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
        const {
          item: item1,
          token: unusedToken,
          appData: appData1,
        } = await setUpForAppData(app, actor);
        const {
          item: item2,
          token: validToken,
          appData: appData2,
        } = await setUpForAppData(app, actor);
        items = [item1, item2];
        appDataArray = { [item1.id]: appData1, [item2.id]: appData2 };
        token = validToken;
      });

      it('Get many app data successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/app-data?itemId=${items[0].id}&itemId=${items[1].id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        Object.entries(response.json()).forEach(([itemId, appDatas]) => {
          expectAppData(appDatas, appDataArray[itemId]);
        });
      });

      it('Get many app data with invalid item id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
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

        ({ item, token, appData } = await setUpForAppData(app, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.GET,
          url: '/logout',
        });
        member = null;
      });

      it('Post app data without member and token throws', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-data`,
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });

      it('Post app data without type throws', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.POST,
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
        ({ item, token } = await setUpForAppData(app, actor));
      });

      it('Post app data successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.POST,
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

      it('Invalid item id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-data`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: appData,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('PATCH /:itemId/app-data/:appDataId', () => {
    const updatedData = { data: { myData: 'value' } };
    let chosenAppData;

    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());

        ({ item, token, appData } = await setUpForAppData(app, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.GET,
          url: '/logout',
        });
        member = null;
      });

      it('Request without member and token throws', async () => {
        const response = await app.inject({
          method: 'PATCH',
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
        ({ item, token, appData } = await setUpForAppData(app, actor));
        chosenAppData = appData[0];
      });

      it('Patch app data successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${chosenAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: updatedData.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json()).toMatchObject(updatedData);
      });

      // it('Throw if app data is a file', async () => {
      //   const fileAppSetting = buildAppSetting({
      //     data: buildFileItemData({
      //       name: 'name',
      //       type: fileItemType,
      //       filename: 'filename',
      //       filepath: 'filepath',
      //       size: 120,
      //       mimetype: 'mimetype',
      //     }),
      //   });
      //   appSettingService.getById = jest.fn().mockResolvedValue(fileAppSetting);
      //   appSettingService.update = jest.fn().mockResolvedValue(fileAppSetting);

      //   const updateTask = new UpdateAppSettingTask(
      //     GRAASP_ACTOR,
      //     fileAppSetting.id,
      //     data,
      //     itemId,
      //     requestDetails,
      //     appSettingService,
      //     itemService,
      //     itemMembershipService,
      //     fileItemType,
      //   );

      //   try {
      //     await updateTask.run(handler);
      //   } catch (e) {
      //     expect(e).toBeInstanceOf(PreventUpdateAppSettingFile);
      //     expect(appSettingService.update).not.toHaveBeenCalled();
      //   }
      // });

      it('Invalid item id throws bad request', async () => {
        const response = await app.inject({
          method: 'PATCH',
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-data/${chosenAppData.id}`,
          payload: { data: updatedData.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Invalid app data id throws bad request', async () => {
        const response = await app.inject({
          method: 'PATCH',
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/invalid-id`,
          payload: { data: updatedData.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('DELETE /:itemId/app-data/:appDataId', () => {
    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());

        ({ item, token, appData } = await setUpForAppData(app, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.GET,
          url: '/logout',
        });
        member = null;
      });

      it('Delete app data without member and token throws', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,

          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${v4()}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Sign In', () => {
      let chosenAppData;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, token, appData } = await setUpForAppData(app, actor));
        chosenAppData = appData[0];
      });

      it('Delete app data successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,

          url: `${APP_ITEMS_PREFIX}/${item.id}/app-data/${chosenAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.body).toEqual(chosenAppData.id);

        const appSetting = await AppDataRepository.get(chosenAppData.id);
        expect(appSetting).toBeFalsy();
      });

      it('Delete app data with invalid id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,

          url: `${APP_ITEMS_PREFIX}/invalid-id/app-data/${chosenAppData.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Delete app data with invalid app data id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,
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
