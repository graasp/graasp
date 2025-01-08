import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate } from '../../../../../../../test/app';
import { APP_ITEMS_PREFIX } from '../../../../../../utils/config';
import { Member } from '../../../../../member/entities/member';
import { saveMember } from '../../../../../member/test/fixtures/members';
import { AppTestUtils } from '../../test/fixtures';
import { AppActionRepository } from '../repository';
import { saveAppActions } from './fixtures';

const testUtils = new AppTestUtils();

const expectAppAction = (values, expected) => {
  for (const expectValue of expected) {
    const value = values.find(({ id }) => id === expectValue.id);
    expect(value.type).toEqual(expectValue.type);
    expect(value.data).toEqual(expectValue.data);
  }
};

// save apps, app actions, and get token
const setUpForAppActions = async (
  app,
  actor: Member,
  creator: Member,
  permission?: PermissionLevel,
) => {
  const values = await testUtils.setUp(app, actor, creator, permission);
  const appActions = await saveAppActions({ item: values.item, member: actor });
  return { ...values, appActions };
};

describe('App Actions Tests', () => {
  let app: FastifyInstance;
  let item, token;
  let appActions;
  let member;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });
  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    member = null;
    item = null;
    token = null;
    appActions = null;
  });

  // TODO test different payload
  // TODO: get with many filters
  describe('GET /:itemId/app-action', () => {
    describe('Sign Out', () => {
      beforeEach(async () => {
        const actor = await saveMember();
        mockAuthenticate(actor);
        ({ item, token, appActions } = await setUpForAppActions(app, actor, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.Get,
          url: '/logout',
        });
      });

      it('Get app actions without member and token throws', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-action`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    // TODO: public

    describe('Sign In', () => {
      describe('Admin', () => {
        beforeEach(async () => {
          const actor = await saveMember();
          mockAuthenticate(actor);
          ({ item, appActions, token } = await setUpForAppActions(app, actor, actor));
        });

        it('Get all app actions with admin permission', async () => {
          // get other users' actions
          member = await saveMember();
          const otherActions = await saveAppActions({ item, member });

          const response = await app.inject({
            method: HttpMethod.Get,
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
            method: HttpMethod.Get,
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
          const actor = await saveMember();
          mockAuthenticate(actor);
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
            method: HttpMethod.Get,
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

  // TODO test different payload
  describe('POST /:itemId/app-action', () => {
    const payload = { data: { some: 'data' }, type: 'some-type' };

    describe('Sign Out', () => {
      beforeEach(async () => {
        const actor = await saveMember();
        mockAuthenticate(actor);

        ({ item, token, appActions } = await setUpForAppActions(app, actor, actor));
        // logout after getting token and setting up
        await app.inject({
          method: HttpMethod.Get,
          url: '/logout',
        });
        member = null;
      });

      it('Post app actions without member and token throws', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-action`,
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });

      it('Post app actions without type throws', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.Post,
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
        const actor = await saveMember();
        mockAuthenticate(actor);
        ({ item, token } = await setUpForAppActions(app, actor, actor));
      });

      it('Post app actions successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
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

        const savedAppAction = await new AppActionRepository().getOne(newAppAction.id);
        expectAppAction([newAppAction], [savedAppAction]);
      });

      it('Invalid item id throws', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
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
