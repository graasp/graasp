/**
 * These tests make sure we keep legacy properties to ensure compatibility with old apps
 * We continue to send "member" for legacy apps
 * */
import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../../test/app';
import { seedFromJson } from '../../../../../../../test/mocks/seed';
import { db } from '../../../../../../drizzle/db';
import { assertIsDefined } from '../../../../../../utils/assertions';
import { APP_ITEMS_PREFIX } from '../../../../../../utils/config';
import { assertIsMemberForTest } from '../../../../../authentication';
import { getAccessToken } from '../../test/fixtures';

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

  describe('GET /:itemId/app-action', () => {
    it('Get member in app actions', async () => {
      const { apps } = await seedFromJson({ apps: [{}] });
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
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
      returnedAppActions.forEach((aa) => {
        expect(aa.member.id).toBeDefined();
      });
    });
  });

  // TODO: remove ? we don't return app action anymore on post
  // describe('POST /:itemId/app-action', () => {
  //   it('Post app actions successfully', async () => {
  //     const { apps } = await seedFromJson({ apps: [{}] });
  //     const {
  //       actor,
  //       items: [item],
  //     } = await seedFromJson({
  //       items: [
  //         {
  //           memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
  //           type: ItemType.APP,
  //           appActions: [
  //             { account: 'actor' },
  //             { account: 'actor' },
  //             { account: { name: 'bob' } },
  //             { account: { name: 'bob' } },
  //           ],
  //         },
  //       ],
  //     });
  //     assertIsDefined(actor);
  //     assertIsMemberForTest(actor);
  //     mockAuthenticate(actor);
  //     const chosenApp = apps[0];

  //     const token = await getAccessToken(app, item, chosenApp);
  //     const payload = { data: { some: 'data' }, type: 'some-type' };
  //     const response = await app.inject({
  //       method: HttpMethod.Post,
  //       url: `${APP_ITEMS_PREFIX}/${item.id}/app-action`,
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //       },
  //       payload,
  //     });
  //     expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
  //     const newAppAction = await db.query.appActions.findFirst({
  //       where: and(eq(appActions.type, payload.type), eq(appActions.itemId, item.id)),
  //     });
  //     assertIsDefined(newAppAction);
  //     expect(newAppAction.member.id).toEqual(actor.id);
  //   });
  // });
});
