import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { HttpMethod, ItemType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { expectItem, getDummyItem } from '../../../../../../test/fixtures/items';
import { BOB, expectMember, saveMember } from '../../../../../../test/fixtures/members';
import { saveItemAndMembership } from '../../../../../../test/fixtures/memberships';
import { APP_ITEMS_PREFIX } from '../../../../../util/config';
import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { PublisherRepository } from '../publisherRepository';
import { AppRepository } from '../repository';
import { MOCK_APPS, MOCK_APP_ORIGIN, MOCK_TOKEN } from './fixtures';

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
    it('Unauthorized member cannot get apps list', async () => {
      ({ app } = await build({ member: null }));
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `${APP_ITEMS_PREFIX}/list`,
      });
      const data = response.json();
      expect(data.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    it('Get apps list', async () => {
      ({ app } = await build());
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

    // TODO: allow public

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
          payload: { origin: MOCK_APP_ORIGIN, key: v4() },
        });
        // the call should fail: suppose verifyAuthentication works correctly and throws

        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
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

    // TODO: allow public: with token but without member should pass

    describe('Signed Out', () => {
      it('Request without token and without member throws', async () => {
        const item = { id: v4() };

        ({ app, actor } = await build({ member: null }));
        apps = await saveAppList();

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${APP_ITEMS_PREFIX}/${item.id}/context`,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
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
        expect(response.json().members).toHaveLength(1);
        expectMember(response.json().members[0], actor);
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
        const result = response.json();

        const { members, children } = result;
        expectItem(result, parentItem);
        expect(children).toHaveLength(2);

        expect(members).toHaveLength(1);
        expectMember(members[0], actor);
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
