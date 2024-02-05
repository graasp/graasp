import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../../test/app';
import { APP_ITEMS_PREFIX } from '../../../../../../utils/config';
import { Member } from '../../../../../member/entities/member';
import { saveMember } from '../../../../../member/test/fixtures/members';
import { Item } from '../../../../entities/Item';
import { setUp } from '../../test/fixtures';
import { AppActionRepository } from '../repository';

// mock datasource
jest.mock('../../../../../../plugins/datasource');

const expectAppAction = (values, expected) => {
  for (const expectValue of expected) {
    const value = values.find(({ id }) => id === expectValue.id);
    expect(value.type).toEqual(expectValue.type);
    expect(value.data).toEqual(expectValue.data);
  }
};

export const saveAppActions = async ({ item, member }: { item: Item; member?: Member }) => {
  const defaultData = { type: 'some-type', data: { some: 'data' } };
  const s1 = await AppActionRepository.save({ item, member, ...defaultData });
  const s2 = await AppActionRepository.save({ item, member, ...defaultData });
  const s3 = await AppActionRepository.save({ item, member, ...defaultData });
  return [s1, s2, s3];
};

// save apps, app actions, and get token
const setUpForAppActions = async (
  app,
  actor: Member,
  creator: Member,
  permission?: PermissionLevel,
) => {
  const values = await setUp(app, actor, creator, permission);
  const appActions = await saveAppActions({ item: values.item, member: actor });
  return { ...values, appActions };
};

describe('App Actions Tests', () => {
  let app;
  let actor;
  let item, token;
  let appActions;
  let member;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    member = null;
    item = null;
    token = null;
    appActions = null;
    app.close();
  });

  // TODO test different payload
  // TODO: get with many filters
  describe('GET /:itemId/app-action', () => {
    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());

        ({ item, token, appActions } = await setUpForAppActions(app, actor, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.GET,
          url: '/logout',
        });
      });

      it('Get app actions without member and token throws', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-action`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    // TODO: public

    describe('Sign In', () => {
      describe('Admin', () => {
        beforeEach(async () => {
          ({ app, actor } = await build());
          ({ item, appActions, token } = await setUpForAppActions(app, actor, actor));
        });

        it('Get all app actions with admin permission', async () => {
          // get other users' actions
          member = await saveMember();
          const otherActions = await saveAppActions({ item, member });

          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${APP_ITEMS_PREFIX}/${item.id}/app-action`,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          expect(response.statusCode).toEqual(StatusCodes.OK);
          const returnedAppActions = response.json();
          expectAppAction(returnedAppActions, appActions);

          // get other users' actions
          otherActions.forEach(({ id }) => {
            expect(returnedAppActions.find(({ id: thisId }) => thisId === id)).toBeTruthy();
          });
        });

        it('Get app actions with invalid item id throws', async () => {
          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${APP_ITEMS_PREFIX}/invalid-id/app-action`,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
      });

      describe('Read', () => {
        beforeEach(async () => {
          ({ app, actor } = await build());
          member = await saveMember();
          ({ item, appActions, token } = await setUpForAppActions(
            app,
            actor,
            member,
            PermissionLevel.Read,
          ));
        });

        it('Get only own app actions if has read permission', async () => {
          // should not fetch other members' actions
          const otherActions = await saveAppActions({ item, member });

          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${APP_ITEMS_PREFIX}/${item.id}/app-action`,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          expect(response.statusCode).toEqual(StatusCodes.OK);
          const returnedAppActions = response.json();
          expectAppAction(returnedAppActions, appActions);

          // contains only own actions
          otherActions.forEach(({ id }) => {
            expect(returnedAppActions.find(({ id: thisId }) => thisId === id)).toBeFalsy();
          });
        });
      });
    });
  });

  describe('GET many /app-action', () => {
    let items;
    let appActionsArray;

    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());

        // unefficient way of registering two apps and their app actions
        ({ item, token, appActions } = await setUpForAppActions(app, actor, actor));

        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.GET,
          url: '/logout',
        });
      });

      it('Get many app actions without member and token throws', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/app-action?itemId=${item.id}`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    // TODO: public
    // TODO: get with many filters
    describe('Sign In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());

        // unefficient way of registering two apps and their app actions
        const { item: item1, appActions: appActions1 } = await setUpForAppActions(
          app,
          actor,
          actor,
        );
        const {
          item: item2,
          token: validToken,
          appActions: appActions2,
        } = await setUpForAppActions(app, actor, actor);
        items = [item1, item2];
        appActionsArray = { [item1.id]: appActions1, [item2.id]: appActions2 };
        token = validToken;
      });

      it('Get many app actions successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/app-action?itemId=${items[0].id}&itemId=${items[1].id}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        Object.entries(response.json().data).forEach(([itemId, appActions]) => {
          expectAppAction(appActions, appActionsArray[itemId]);
        });
      });

      it('Get many app actions with invalid item id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/app-action?itemId=invalid-id`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });

  // TODO test different payload
  describe('POST /:itemId/app-action', () => {
    const payload = { data: { some: 'data' }, type: 'some-type' };

    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());

        ({ item, token, appActions } = await setUpForAppActions(app, actor, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.GET,
          url: '/logout',
        });
        member = null;
      });

      it('Post app actions without member and token throws', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-action`,
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });

      it('Post app actions without type throws', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-action`,
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
        ({ item, token } = await setUpForAppActions(app, actor, actor));
      });

      it('Post app actions successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-action`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const newAppAction = response.json();

        // we don't use the util function because it does not contain an id for iteration
        expect(newAppAction.type).toEqual(payload.type);
        expect(newAppAction.data).toEqual(payload.data);

        const savedAppAction = await AppActionRepository.get(newAppAction.id);
        expectAppAction([newAppAction], [savedAppAction]);
      });

      it('Invalid item id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-action`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: appActions,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
