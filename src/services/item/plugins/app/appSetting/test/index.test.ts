import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../../test/app';
import { APP_ITEMS_PREFIX } from '../../../../../../utils/config';
import { MemberCannotAdminItem } from '../../../../../../utils/errors';
import { saveItemAndMembership } from '../../../../../itemMembership/test/fixtures/memberships';
import { Member } from '../../../../../member/entities/member';
import { BOB, saveMember } from '../../../../../member/test/fixtures/members';
import { setItemPublic } from '../../../itemTag/test/fixtures';
import { setUp } from '../../test/fixtures';
import { AppSettingRepository } from '../repository';

const expectAppSettings = (values, expected) => {
  for (const expectValue of expected) {
    const value = values.find(({ id }) => id === expectValue.id);
    expect(value.name).toEqual(expectValue.name);
    expect(value.data).toEqual(expectValue.data);
  }
};

// mock datasource
jest.mock('../../../../../../plugins/datasource');

const saveAppSettings = async ({ item, creator }) => {
  const defaultData = { name: 'setting-name', data: { setting: 'value' } };
  const s1 = await AppSettingRepository.save({ item, creator, ...defaultData });
  const s2 = await AppSettingRepository.save({ item, creator, ...defaultData });
  const s3 = await AppSettingRepository.save({ item, creator, ...defaultData });
  const s4 = await AppSettingRepository.save({
    item,
    creator,
    ...defaultData,
    name: 'new-setting',
  });
  return [s1, s2, s3, s4];
};

const setUpForAppSettings = async (
  app,
  actor: Member,
  creator: Member,
  permission?: PermissionLevel,
) => {
  const values = await setUp(app, actor, creator, permission);
  const appSettings = await saveAppSettings({ item: values.item, creator: creator ?? actor });
  return { ...values, appSettings };
};

describe('Apps Settings Tests', () => {
  let app;
  let actor;
  let item, token;
  let appSettings;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    item = null;
    token = null;
    appSettings = null;
    app.close();
  });

  describe('GET /:itemId/app-settings', () => {
    let member;

    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        member = actor;
        ({ item, token, appSettings } = await setUpForAppSettings(app, actor, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.GET,
          url: '/logout',
        });
      });

      it('Get app setting throws without token', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });

      it('Get app setting for public item', async () => {
        await setItemPublic(item, member);

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expectAppSettings(response.json(), appSettings);
      });
    });

    describe('Sign In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Get app setting without token throws', async () => {
        const { item } = await setUpForAppSettings(app, actor, actor);

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });

      it('Get app settings successfully', async () => {
        const { item, appSettings, token } = await setUpForAppSettings(app, actor, actor);

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectAppSettings(response.json(), appSettings);
      });

      it('Get named app setting successfully', async () => {
        const { item, appSettings, token } = await setUpForAppSettings(app, actor, actor);

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings?name=new-setting`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expectAppSettings(response.json(), [appSettings.find((s) => s.name === 'new-setting')]);
      });

      it('Get app setting with invalid item id throws', async () => {
        const { token } = await setUpForAppSettings(app, actor, actor);

        const response = await app.inject({
          method: HttpMethod.GET,
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
    const appSetting = { name: 'my-name', data: { some: 'data' } };

    describe('Sign Out', () => {
      it('Post app setting without member and token throws', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-settings`,
          payload: appSetting,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Sign In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Post app setting successfully', async () => {
        ({ item, token } = await setUpForAppSettings(app, actor, actor));

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: appSetting,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const newAppSetting = response.json();

        // we don't use the util function because it does not contain an id for iteration
        expect(newAppSetting.name).toEqual(appSetting.name);
        expect(newAppSetting.data).toEqual(appSetting.data);

        const savedAppSetting = await AppSettingRepository.get(newAppSetting.id);
        expectAppSettings([newAppSetting], [savedAppSetting]);
      });

      it('Post app setting throws for read membership', async () => {
        const member = await saveMember(BOB);
        ({ item, appSettings, token } = await setUpForAppSettings(
          app,
          actor,
          member,
          PermissionLevel.Read,
        ));

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: appSetting,
        });
        expect(response.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });

      it('Post app setting throws for write membership', async () => {
        const member = await saveMember(BOB);
        ({ item, appSettings, token } = await setUpForAppSettings(
          app,
          actor,
          member,
          PermissionLevel.Write,
        ));

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: appSetting,
        });
        expect(response.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });

      it('Invalid item id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.POST,
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
    const updatedSetting = { data: { mySetting: 'value' } };
    let chosenAppSetting;

    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
      });

      it('Request without member and token throws', async () => {
        const response = await app.inject({
          method: 'PATCH',
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-settings/${v4()}`,
          payload: { data: updatedSetting.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Sign In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        let appSettings;
        ({ item, token, appSettings } = await setUpForAppSettings(app, actor, actor));
        chosenAppSetting = appSettings[0];
      });

      it('Patch app settings successfully', async () => {
        expect(app).toBeTruthy();

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
        const member = await saveMember(BOB);
        ({ item, appSettings, token } = await setUpForAppSettings(
          app,
          actor,
          member,
          PermissionLevel.Read,
        ));

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
        const member = await saveMember(BOB);
        ({ item, appSettings, token } = await setUpForAppSettings(
          app,
          actor,
          member,
          PermissionLevel.Write,
        ));

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

      // it('Throw if app setting is a file', async () => {
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
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-settings/${chosenAppSetting.id}`,
          payload: { data: updatedSetting.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Invalid app setting id throws bad request', async () => {
        const response = await app.inject({
          method: 'PATCH',
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/invalid-id`,
          payload: { data: updatedSetting.data },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('DELETE /:itemId/app-settings/:appSettingId', () => {
    describe('Sign Out', () => {
      it('Delete app setting without member and token throws', async () => {
        ({ app, actor } = await build({ member: null }));
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({ member });

        const response = await app.inject({
          method: HttpMethod.DELETE,

          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/${v4()}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Sign In', () => {
      let chosenAppSetting;

      beforeEach(async () => {
        ({ app, actor } = await build());
        let appSettings;
        ({ item, token, appSettings } = await setUpForAppSettings(app, actor, actor));
        chosenAppSetting = appSettings[0];
      });

      it('Delete app setting successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,

          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/${chosenAppSetting.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.body).toEqual(chosenAppSetting.id);

        const appSetting = await AppSettingRepository.get(chosenAppSetting.id);
        expect(appSetting).toBeFalsy();
      });

      it('Delete app setting with invalid id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,

          url: `${APP_ITEMS_PREFIX}/invalid-id/app-settings/${chosenAppSetting.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Delete app setting with invalid app setting id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/invalid-id`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Delete app setting throws for read membership', async () => {
        const member = await saveMember(BOB);
        ({ item, appSettings, token } = await setUpForAppSettings(
          app,
          actor,
          member,
          PermissionLevel.Read,
        ));

        const response = await app.inject({
          method: HttpMethod.DELETE,

          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/${chosenAppSetting.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });

      it('Delete app setting throws for write membership', async () => {
        const member = await saveMember(BOB);
        ({ item, appSettings, token } = await setUpForAppSettings(
          app,
          actor,
          member,
          PermissionLevel.Write,
        ));

        const response = await app.inject({
          method: HttpMethod.DELETE,

          url: `${APP_ITEMS_PREFIX}/${item.id}/app-settings/${chosenAppSetting.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });
    });
  });

  // describe('Hooks', () => {
  //   describe('Copy Post Hook', () => {
  //     const taskName = itemTaskManager.getCopyTaskName();
  //     const actor = GRAASP_ACTOR;

  //     it('Stop if item is not an app item', async () => {
  //       jest.spyOn(runner, 'setTaskPostHookHandler').mockImplementation(async (name, fn) => {
  //         if (name === taskName) {
  //           const original = { type: 'file', id: 'some-id' };
  //           const fileTaskMock = mockCreateCopyFileTask('newFilePath');
  //           await fn(original, actor, { log: MOCK_LOGGER }, { original });
  //           expect(fileTaskMock).toHaveBeenCalledTimes(0);
  //         }
  //       });
  //       await build();
  //     });
  //     it('Copy all app settings', async () => {
  //       jest.spyOn(runner, 'setTaskPostHookHandler').mockImplementation(async (name, fn) => {
  //         if (name === taskName) {
  //           const original = ITEM_APP;
  //           const appSettings = [buildAppSetting(), buildAppSetting(), buildAppSetting()];
  //           const mockCreate = jest
  //             .spyOn(AppSettingService.prototype, 'create')
  //             .mockImplementation(async (data) => buildAppSetting(data));
  //           jest
  //             .spyOn(AppSettingService.prototype, 'getForItem')
  //             .mockImplementation(async () => appSettings);
  //           const fileTaskMock = mockCreateCopyFileTask('newFilePath');
  //           await fn(original, actor, { log: MOCK_LOGGER }, { original });
  //           expect(mockCreate).toHaveBeenCalledTimes(appSettings.length);
  //           expect(fileTaskMock).toHaveBeenCalledTimes(0);
  //         }
  //       });
  //       await build();
  //     });
  //     it('Copy all app settings and related files', async () => {
  //       jest.spyOn(runner, 'setTaskPostHookHandler').mockImplementation(async (name, fn) => {
  //         if (name === taskName) {
  //           const original = ITEM_APP;

  //           const appSettings = [
  //             buildAppSetting(),
  //             buildAppSetting(),
  //             buildAppSetting({
  //               name: 'file-setting',
  //               data: buildFileItemData({
  //                 name: 'myfile',
  //                 type: defaultOptions.fileItemType,
  //                 filename: 'filename',
  //                 mimetype: 'mimetype',
  //                 size: 400,
  //                 filepath: 'filepath',
  //               }),
  //             }),
  //           ];
  //           const mockCreate = jest
  //             .spyOn(AppSettingService.prototype, 'create')
  //             .mockImplementation(async (data) => buildAppSetting(data));
  //           jest
  //             .spyOn(AppSettingService.prototype, 'getForItem')
  //             .mockImplementation(async () => appSettings);
  //           const fileTaskMock = mockCreateCopyFileTask('newFilePath');
  //           await fn(original, actor, { log: MOCK_LOGGER }, { original });
  //           expect(mockCreate).toHaveBeenCalledTimes(appSettings.length);
  //           expect(fileTaskMock).toHaveBeenCalledTimes(1);
  //         }
  //       });
  //       await build();
  //     });
  //   });
});
