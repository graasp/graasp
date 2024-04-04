import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { APP_ITEMS_PREFIX } from '../../../../../utils/config';
import { Actor, Member } from '../../../../member/entities/member';
import { expectMinimalMember, saveMember } from '../../../../member/test/fixtures/members';
import { Item } from '../../../entities/Item';
import { expectItem } from '../../../test/fixtures/items';
import { setItemPublic } from '../../itemTag/test/fixtures';
import { AppTestUtils, MOCK_APP_ORIGIN } from './fixtures';

// mock datasource
jest.mock('../../../../../plugins/datasource');

const testUtils = new AppTestUtils();

const setUpForAppContext = async (
  app,
  actor: Actor,
  creator: Member,
  permission?: PermissionLevel,
  setPublic?: boolean,
  parentItem?: Item,
) => {
  const values = await testUtils.setUp(app, actor, creator, permission, setPublic, parentItem);
  const appList = await testUtils.saveAppList();
  return { ...values, appList };
};

describe('Apps Plugin Tests', () => {
  let app;
  let actor: Actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor;
    app.close();
  });

  describe('GET /list', () => {
    it('Get apps list', async () => {
      ({ app } = await build({ member: null }));
      const apps = await testUtils.saveAppList();

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${APP_ITEMS_PREFIX}/list`,
      });
      const data = response.json();
      expect(data[0].name).toEqual(apps[0].name);
      expect(data[0].url).toEqual(apps[0].url);
      expect(data[0].id).toBeFalsy();
    });
  });

  describe('POST /:itemId/api-access-token', () => {
    let apps;

    describe('Signed Out', () => {
      it('Unauthenticated member throws error', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember();
        apps = await testUtils.saveAppList();
        const chosenApp = apps[0];
        const { item } = await testUtils.saveApp({ url: chosenApp.url, member });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: chosenApp.url, key: chosenApp.key },
        });
        // the call should fail: suppose verifyAuthentication works correctly and throws

        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      });
    });

    describe('Public', () => {
      it('Successfully request api access', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember();
        apps = await testUtils.saveAppList();
        const chosenApp = apps[0];
        const { item } = await testUtils.saveApp({ url: chosenApp.url, member });
        await setItemPublic(item, member);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: chosenApp.url, key: chosenApp.key },
        });
        expect(response.json().token).toBeTruthy();
      });
    });

    describe('Signed In', () => {
      let chosenApp;

      beforeEach(async () => {
        ({ app, actor } = await build());
        apps = await testUtils.saveAppList();
        chosenApp = apps[0];
      });

      it('Request api access', async () => {
        if (!actor) {
          throw new Error('actor is not defined');
        }
        const { item } = await testUtils.saveApp({ url: chosenApp.url, member: actor });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: chosenApp.url, key: chosenApp.key },
        });
        expect(response.json().token).toBeTruthy();
      });

      it('Incorrect params throw bad request', async () => {
        const item = { id: v4() };

        expect(app).toBeTruthy();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: MOCK_APP_ORIGIN },
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
        const member = await saveMember();
        const { item } = await testUtils.saveApp({ url: chosenApp.url, member });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: MOCK_APP_ORIGIN, key: v4() },
        });

        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      });
    });
  });

  describe('GET /:itemId/context', () => {
    describe('Public', () => {
      it('Get app context successfully for one item without members', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember();
        const { item, token } = await setUpForAppContext(app, member, member, undefined, true);

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
        const item = { id: v4() };

        ({ app, actor } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      let token: string;
      let item: Item;
      let actor: Actor;

      it('Get app context successfully for one item', async () => {
        ({ app, actor } = await build());
        const member = await saveMember();
        ({ item, token } = await setUpForAppContext(app, actor, member, PermissionLevel.Read));
        if (!actor) {
          throw new Error('actor is undefined');
        }
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
        expect(data.members).toHaveLength(2);
        for (const m of response.json().members) {
          const expectedMember = m.id === actor.id ? actor : member;
          expectMinimalMember(m, expectedMember);
        }
      });

      it('Get app context successfully for one item and its private parent', async () => {
        ({ app, actor } = await build());
        if (!actor) {
          throw new Error('actor is undefined');
        }
        const member = await saveMember();
        const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
        await testUtils.saveItemAndMembership({ member: actor, parentItem });
        ({ item, token } = await setUpForAppContext(
          app,
          actor,
          member,
          PermissionLevel.Read,
          false,
          parentItem,
        ));

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const result = response.json();

        const { members, item: resultItem } = result;
        expectItem(resultItem, item);

        expect(members).toHaveLength(2);
        for (const m of response.json().members) {
          const expectedMember = m.id === actor.id ? actor : member;
          expectMinimalMember(m, expectedMember);
        }
      });

      it('Get app context successfully for one item and its public parent', async () => {
        ({ app, actor } = await build());
        if (!actor) {
          throw new Error('actor is undefined');
        }
        const member = await saveMember();
        const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
        await testUtils.saveItemAndMembership({ member: actor, parentItem });
        await setItemPublic(parentItem, actor);

        ({ item, token } = await setUpForAppContext(
          app,
          actor,
          member,
          PermissionLevel.Read,
          false,
          parentItem,
        ));

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const result = response.json();

        const { members, item: resultItem } = result;
        expectItem(resultItem, item);

        expect(members).toHaveLength(2);
        for (const m of response.json().members) {
          const expectedMember = m.id === actor.id ? actor : member;
          expectMinimalMember(m, expectedMember);
        }
      });

      it('Invalid item id throws bad request', async () => {
        ({ app, actor } = await build());

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${APP_ITEMS_PREFIX}/invalid-id/context`,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
