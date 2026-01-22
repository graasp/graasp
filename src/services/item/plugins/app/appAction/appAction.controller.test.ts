import { and, eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { db } from '../../../../../drizzle/db';
import { appActionsTable } from '../../../../../drizzle/schema';
import type { AppActionRaw } from '../../../../../drizzle/types';
import { assertIsDefined } from '../../../../../utils/assertions';
import { APP_ITEMS_PREFIX } from '../../../../../utils/config';
import { assertIsMemberForTest } from '../../../../authentication';
import { getAccessToken } from '../test/fixtures';

const expectAppActions = (
  values: Pick<AppActionRaw, 'id' | 'type' | 'data'>[],
  expected: Pick<AppActionRaw, 'id' | 'type' | 'data'>[],
) => {
  for (const expectValue of expected) {
    const value = values.find(({ id }) => id === expectValue.id);
    assertIsDefined(value);
    expect(value.type).toEqual(expectValue.type);
    expect(value.data).toEqual(expectValue.data);
  }
};

describe('App Actions Tests', () => {
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
  describe('GET /:itemId/app-action', () => {
    describe('Sign Out', () => {
      it('Get app actions without member and token throws', async () => {
        const {
          items: [item],
        } = await seedFromJson({ items: [{}] });

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
        it('Get all app actions with admin permission', async () => {
          const { apps } = await seedFromJson({ apps: [{}] });
          const {
            actor,
            items: [item],
            appActions,
          } = await seedFromJson({
            items: [
              {
                memberships: [{ account: 'actor', permission: 'admin' }],
                type: ItemType.APP,
                appActions: [
                  { account: 'actor' },
                  { account: 'actor' },
                  { account: { name: 'bob' } },
                  { account: { name: 'bob' } },
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
            url: `${APP_ITEMS_PREFIX}/${item.id}/app-action`,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          expect(response.statusCode).toEqual(StatusCodes.OK);
          const returnedAppActions = response.json();
          expectAppActions(returnedAppActions, appActions);
        });

        it('Get app actions with invalid item id throws', async () => {
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
            url: `${APP_ITEMS_PREFIX}/invalid-id/app-action`,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
      });

      describe('Read', () => {
        it('Get only own app actions if has read permission', async () => {
          const { apps } = await seedFromJson({ apps: [{}] });
          const {
            actor,
            items: [item],
            appActions,
          } = await seedFromJson({
            items: [
              {
                memberships: [{ account: 'actor', permission: 'read' }],
                type: ItemType.APP,
                appActions: [
                  { account: 'actor' },
                  { account: 'actor' },
                  // should not fetch other members' actions
                  { account: { name: 'bob' } },
                  { account: { name: 'bob' } },
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
            url: `${APP_ITEMS_PREFIX}/${item.id}/app-action`,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          expect(response.statusCode).toEqual(StatusCodes.OK);

          const [actorAction, actorAction1, ...otherActions] = appActions;
          const wantedAppActions = [actorAction, actorAction1];
          const returnedAppActions = response.json<AppActionRaw[]>();
          expectAppActions(returnedAppActions, wantedAppActions);
          // contains only own actions
          otherActions.forEach(({ id }) => {
            expect(returnedAppActions.find(({ id: thisId }) => thisId === id)).toBeFalsy();
          });
        });
      });
    });
  });

  // // TODO test different payload
  describe('POST /:itemId/app-action', () => {
    describe('Sign Out', () => {
      it('Post app actions without member and token throws', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${v4()}/app-action`,
          payload: { type: 'type', data: { some: 'data' } },
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
      it('Post app actions without type throws', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'read' }],
              type: ItemType.APP,
              appActions: [{ account: 'actor' }, { account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const token = await getAccessToken(app, item, chosenApp);
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
      it('Post app actions successfully', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
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

        const token = await getAccessToken(app, item, chosenApp);

        const payload = { data: { some: 'data' }, type: 'some-type' };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/app-action`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

        const newAppAction = await db.query.appActionsTable.findFirst({
          where: and(eq(appActionsTable.type, payload.type), eq(appActionsTable.itemId, item.id)),
        });
        assertIsDefined(newAppAction);
        expect(newAppAction.type).toEqual(payload.type);
        expect(newAppAction.data).toEqual(payload.data);
        const savedAppAction = await db.query.appActionsTable.findFirst({
          where: eq(appActionsTable.id, newAppAction.id),
        });
        assertIsDefined(savedAppAction);
        expectAppActions([newAppAction], [savedAppAction]);
      });
      it('Invalid item id throws', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const chosenApp = apps[0];
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/invalid-id/app-action`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: { data: { some: 'data' }, type: 'some-type' },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
