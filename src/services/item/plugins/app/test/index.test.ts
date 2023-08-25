import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { APP_ITEMS_PREFIX } from '../../../../../utils/config';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { BOB, expectMinimalMember, saveMember } from '../../../../member/test/fixtures/members';
import { expectItem } from '../../../test/fixtures/items';
import { setItemPublic } from '../../itemTag/test/fixtures';
import { MOCK_APP_ORIGIN, MOCK_TOKEN, saveApp, saveAppList } from './fixtures';

// mock datasource
jest.mock('../../../../../plugins/datasource');

describe('Apps Plugin Tests', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /list', () => {
    it('Get apps list', async () => {
      ({ app } = await build({ member: null }));
      const apps = await saveAppList();

      const response = await app.inject({
        method: HttpMethod.GET,
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
        const member = await saveMember(BOB);
        apps = await saveAppList();
        const chosenApp = apps[0];
        const { item } = await saveApp({ url: chosenApp.url, member });

        const response = await app.inject({
          method: HttpMethod.POST,
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
        const member = await saveMember(BOB);
        apps = await saveAppList();
        const chosenApp = apps[0];
        const { item } = await saveApp({ url: chosenApp.url, member });
        await setItemPublic(item, member);

        const response = await app.inject({
          method: HttpMethod.POST,
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
        apps = await saveAppList();
        chosenApp = apps[0];
      });

      it('Request api access', async () => {
        const { item } = await saveApp({ url: chosenApp.url, member: actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: chosenApp.url, key: chosenApp.key },
        });
        expect(response.json().token).toBeTruthy();
      });

      it('Incorrect params throw bad request', async () => {
        const item = { id: v4() };

        expect(app).toBeTruthy();

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: MOCK_APP_ORIGIN },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);

        const response1 = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { key: v4() },
        });
        expect(response1.statusCode).toEqual(StatusCodes.BAD_REQUEST);

        const response2 = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/unknown/api-access-token`,
          payload: { key: v4() },
        });
        expect(response2.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Unauthorized if actor does not have membership on the app item', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveApp({ url: chosenApp.url, member });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
          payload: { origin: MOCK_APP_ORIGIN, key: v4() },
        });

        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      });
    });
  });

  describe('GET /:itemId/context', () => {
    let apps;
    let chosenApp;

    describe('Public', () => {
      it('Get app context successfully for one item without members', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember(BOB);
        apps = await saveAppList();
        chosenApp = apps[0];

        const { item } = await saveApp({ url: chosenApp.url, member });
        await setItemPublic(item, member);

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const data = response.json();
        expect(data.id).toEqual(item.id);
        expect(data.members).toBeUndefined();
      });
    });

    describe('Signed Out', () => {
      it('Request without token and without member throws', async () => {
        const item = { id: v4() };

        ({ app, actor } = await build({ member: null }));
        apps = await saveAppList();

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
        });
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        apps = await saveAppList();
        chosenApp = apps[0];
      });
      it('Get app context successfully for one item', async () => {
        const { item } = await saveApp({ url: chosenApp.url, member: actor });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const data = response.json();
        expect(data.id).toEqual(item.id);
        expect(data.members).toHaveLength(1);
        expectMinimalMember(response.json().members[0], actor);
      });

      it('Get app context successfully for one item and its parents', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        await saveItemAndMembership({ member: actor, parentItem });
        const { item } = await saveApp({ url: chosenApp.url, member: actor, parentItem });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        });
        const result = await response.json();

        const { members, children } = result;
        expectItem(result, parentItem);
        expect(children).toHaveLength(2);

        expect(members).toHaveLength(1);
        expectMinimalMember(members[0], actor);
      });

      it('Invalid item id throws bad request', async () => {
        expect(app).toBeTruthy();

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/invalid-id/context`,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
