import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { Context, HttpMethod, PermissionLevel, ShortLinkPlatform } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { ShortLinkDuplication, ShortLinkLimitExceed } from '../../../../../utils/errors';
import { saveMember } from '../../../../member/test/fixtures/members';
import { ItemPublishedNotFound } from '../../publication/published/errors';
import { saveItemValidation } from '../../publication/validation/test/utils';
import {
  MOCK_ALIAS,
  MOCK_ITEM_ID,
  MOCK_PLATFORM,
  ShortLinkTestUtils,
  getRedirection,
  injectDelete,
  injectGet,
  injectGetAll,
  injectGetAvailable,
  injectPatch,
  injectPost,
} from './fixtures';

const MOCK_FAKE_ALIAS = 'fake-alias';
const testUtils = new ShortLinkTestUtils();

function expectException(response, ex) {
  expect(response.json().code).toBe(ex.code);
  expect(response.json().message).toBe(ex.message);
}

describe('Short links routes tests', () => {
  let app: FastifyInstance;
  let actor;
  let item;
  let anna;
  let bob;
  let cedric;

  beforeEach(async () => {
    ({ app, actor } = await build());
    bob = await saveMember();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    item = null;
    anna = null;
    bob = null;
    cedric = null;
    app.close();
  });

  describe('PUBLIC tests (member not connected)', () => {
    let shortLinkPayload;

    beforeEach(async () => {
      ({ item } = await testUtils.mockItemAndMemberships({ itemCreator: actor }));
      shortLinkPayload = { itemId: item.id, alias: MOCK_ALIAS, platform: MOCK_PLATFORM };

      const response = await injectPost(app, shortLinkPayload);
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json().alias).toEqual(MOCK_ALIAS);
      unmockAuthenticate();
    });

    describe('POST /short-links without connected member', () => {
      it('Unauthorized if post short links without connected member', async () => {
        const ALIAS = `${MOCK_ALIAS}-POST-UNAUTH`;

        const response = await injectPost(app, {
          alias: ALIAS,
          itemId: MOCK_ITEM_ID,
          platform: MOCK_PLATFORM,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);

        const check = await injectGet(app, ALIAS);
        expect(check.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
    });

    describe('GET /short-links/:itemId without connected member', () => {
      it('Success even if not connected', async () => {
        const response = await injectGet(app, MOCK_ALIAS);
        expect(response.statusCode).toEqual(StatusCodes.MOVED_TEMPORARILY);
        expect(response.headers.location).toEqual(
          getRedirection(shortLinkPayload.itemId, shortLinkPayload.platform),
        );
      });
    });

    describe('PATCH /short-links/:itemId without connected member', () => {
      it('Unauthorized if patch short links without connected member', async () => {
        const response = await injectPatch(app, MOCK_ALIAS, { alias: 'new-alias' });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('DELETE /short-links/:itemId without connected member', () => {
      it('Unauthorized if delete when not connected', async () => {
        const response = await injectDelete(app, MOCK_ALIAS);
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);

        const check = await injectGet(app, MOCK_ALIAS);
        expect(check.statusCode).toEqual(StatusCodes.MOVED_TEMPORARILY);
      });
    });

    describe('GET /short-links/list/:itemId without connected member', () => {
      it('Unauthorized when not connected', async () => {
        const response = await injectGetAll(app, item.id);
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });
  });

  describe('AUTHENTICATED member tests', () => {
    describe('POST /short-links', () => {
      describe('Forbidden access', () => {
        afterEach(async () => {
          const check = await injectGet(app, MOCK_ALIAS);
          expect(check.statusCode).toEqual(StatusCodes.NOT_FOUND);
        });
        it('Forbidden if post short links with unauthorized member', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: bob });

          const response = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
        it('Forbidden if post short links with write permission', async () => {
          const { item } = await testUtils.mockItemAndMemberships({
            itemCreator: bob,
            memberWithPermission: {
              member: actor,
              permission: PermissionLevel.Write,
            },
          });
          const response = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
        it('Forbidden if post short links without permission on public', async () => {
          const { item } = await testUtils.mockItemAndMemberships({
            itemCreator: bob,
            setPublic: true,
          });

          const response = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
      });

      describe('Invalid Alias and body', () => {
        afterEach(async () => {
          const check = await injectGet(app, MOCK_ALIAS);
          expect(check.statusCode).toEqual(StatusCodes.NOT_FOUND);
        });

        it('Bad request if post short links with alias < 6 chars', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });

          const response = await injectPost(app, {
            itemId: item.id,
            alias: '12345',
            platform: MOCK_PLATFORM,
          });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
        it('Bad request if post short links with invalid alias chars', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });

          const response = await injectPost(app, {
            itemId: item.id,
            alias: '1_2$3<45',
            platform: MOCK_PLATFORM,
          });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if post short links without body', async () => {
          const response = await injectPost(app);
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if post short links with empty body', async () => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          const response = await injectPost(app, {});
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
      });

      describe('Conflicts', () => {
        it('Conflict if post short links with already exist alias', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
          const { item: item2 } = await testUtils.mockItemAndMemberships({ itemCreator: actor });

          await injectPost(app, { itemId: item.id, alias: MOCK_ALIAS, platform: MOCK_PLATFORM });

          const response = await injectPost(app, {
            itemId: item2.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expectException(response, new ShortLinkDuplication(MOCK_ALIAS));
        });

        it('Conflict if post short links with already exist platform (limit of one link per platform per item)', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });

          await injectPost(app, { itemId: item.id, alias: MOCK_ALIAS, platform: MOCK_PLATFORM });

          const response = await injectPost(app, {
            itemId: item.id,
            alias: `${MOCK_ALIAS}-2`,
            platform: MOCK_PLATFORM,
          });
          expectException(response, new ShortLinkLimitExceed(MOCK_ALIAS, MOCK_PLATFORM));
        });
      });

      describe('Library short link', () => {
        it('Error if post short links with library platform on unpublished item', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });

          const response = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: Context.Library,
          });
          expectException(response, new ItemPublishedNotFound());
        });

        it('Succeed if post short links with library platform on published item with admin permission', async () => {
          const { item } = await testUtils.mockItemAndMemberships({
            // We have to define dates, otherwise it will be random dates.
            item: {
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            itemCreator: actor,
            setPublic: true,
          });
          // should validate before publishing
          await saveItemValidation({ item });
          const publishRes = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
          });
          expect(publishRes.statusCode).toBe(StatusCodes.OK);

          const response = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: Context.Library,
          });
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json().alias).toEqual(MOCK_ALIAS);
          expect(response.json().platform).toEqual(Context.Library);
        });
      });

      describe('Not Found', () => {
        it('Not found if post short links with item id that not exists', async () => {
          const response = await injectPost(
            app,
            // The itemId MOCK_ITEM_ID not exists.
            { alias: MOCK_ALIAS, itemId: MOCK_ITEM_ID, platform: MOCK_PLATFORM },
          );
          expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);

          const check = await injectGet(app, MOCK_ALIAS);
          expect(check.statusCode).toEqual(StatusCodes.NOT_FOUND);
        });
      });

      describe('Authorized Posts', () => {
        let shortLinkPayload;

        afterEach(async () => {
          const check = await injectGet(app, MOCK_ALIAS);
          expect(check.statusCode).toEqual(StatusCodes.MOVED_TEMPORARILY);
          expect(check.headers.location).toEqual(
            getRedirection(shortLinkPayload.itemId, shortLinkPayload.platform),
          );
        });

        it('Success if post short links with admin permission', async () => {
          const { item } = await testUtils.mockItemAndMemberships({
            itemCreator: bob,
            memberWithPermission: {
              member: actor,
              permission: PermissionLevel.Admin,
            },
          });

          shortLinkPayload = { itemId: item.id, alias: MOCK_ALIAS, platform: MOCK_PLATFORM };

          const response = await injectPost(app, shortLinkPayload);
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json().alias).toEqual(MOCK_ALIAS);
        });
      });
    });

    describe('GET /short-links/:itemId', () => {
      it('Not found if get short links with item id that does not exist', async () => {
        const response = await injectGet(app, MOCK_FAKE_ALIAS);
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
      it('Success even if no permission', async () => {
        const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
        const payload = { itemId: item.id, alias: MOCK_ALIAS, platform: MOCK_PLATFORM };
        const post = await injectPost(app, payload);
        expect(post.statusCode).toEqual(StatusCodes.OK);
        expect(post.json().alias).toEqual(MOCK_ALIAS);

        const response = await injectGet(app, MOCK_ALIAS);

        expect(response.statusCode).toEqual(StatusCodes.MOVED_TEMPORARILY);
        expect(response.headers.location).toEqual(
          getRedirection(payload.itemId, payload.platform as Context),
        );
      });
      it('Success when admin', async () => {
        const { item } = await testUtils.mockItemAndMemberships({
          itemCreator: bob,
          memberWithPermission: {
            member: actor,
            permission: PermissionLevel.Admin,
          },
        });
        const payload = { itemId: item.id, alias: MOCK_ALIAS, platform: MOCK_PLATFORM };
        const post = await injectPost(app, payload);
        expect(post.statusCode).toEqual(StatusCodes.OK);
        expect(post.json().alias).toEqual(MOCK_ALIAS);

        const response = await injectGet(app, MOCK_ALIAS);
        expect(response.statusCode).toEqual(StatusCodes.MOVED_TEMPORARILY);
        expect(response.headers.location).toEqual(
          getRedirection(payload.itemId, payload.platform as Context),
        );
      });
    });

    describe('PATCH /short-links/:itemId', () => {
      it('Not found if patch short links with invalid item id', async () => {
        const response = await injectPatch(app, MOCK_ALIAS, { alias: 'new-alias' });
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
      describe('Forbidden', () => {
        it('Forbidden if patch short links with write permission', async () => {
          const { item } = await testUtils.mockItemAndMemberships({
            itemCreator: actor,
            memberWithPermission: {
              member: bob,
              permission: PermissionLevel.Write,
            },
          });
          const post = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);

          // sign in as bob
          mockAuthenticate(bob);

          const response = await injectPatch(app, MOCK_ALIAS, { alias: 'new-alias' });
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
      });

      describe('Success', () => {
        it('Success if patch short links with admin permission', async () => {
          const { item } = await testUtils.mockItemAndMemberships({
            itemCreator: actor,
            memberWithPermission: {
              member: bob,
              permission: PermissionLevel.Admin,
            },
          });
          const post = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);

          // sign in as bob
          mockAuthenticate(bob);

          const response = await injectPatch(app, MOCK_ALIAS, { alias: 'new-alias' });
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json().platform).toEqual(MOCK_PLATFORM);
          expect(response.json().alias).toEqual('new-alias');
        });

        it('Success if patch full short links with admin permission', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
          const post = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);

          const response = await injectPatch(app, MOCK_ALIAS, { alias: 'new-alias' });
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json().platform).toEqual(MOCK_PLATFORM);
          expect(response.json().alias).toEqual('new-alias');
        });
      });

      describe('Conflict and bad request', () => {
        it('Conflict if patch short links alias with existing one', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
          let post = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: Context.Player,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);
          post = await injectPost(app, {
            itemId: item.id,
            alias: `${MOCK_ALIAS}2`,
            platform: Context.Builder,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);

          const response = await injectPatch(app, `${MOCK_ALIAS}2`, { alias: MOCK_ALIAS });
          expect(response.statusCode).toEqual(StatusCodes.CONFLICT);
        });

        it('Bad request if patch short links alias < 6 chars', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
          const post = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);

          const response = await injectPatch(app, MOCK_ALIAS, { alias: '12345' });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if patch short links alias invalid chars', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
          const post = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);

          const response = await injectPatch(app, MOCK_ALIAS, { alias: 'test$_123' });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if patch short links with empty body', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
          const post = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          const response = await injectPatch(app, MOCK_ALIAS, {});
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if patch short links without body', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
          const post = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);

          const response = await injectPatch(app, MOCK_ALIAS);
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if patch short links with missing attributes in body', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
          const post = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          const response = await injectPatch(app, MOCK_ALIAS, { not_valid: 0 });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if patch short links to change item', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
          const post = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          const response = await injectPatch(app, MOCK_ALIAS, { itemId: MOCK_ITEM_ID });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if patch short links to change platform', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
          const post = await injectPost(app, {
            itemId: item.id,
            alias: MOCK_ALIAS,
            platform: MOCK_PLATFORM,
          });
          expect(post.statusCode).toEqual(StatusCodes.OK);

          const response = await injectPatch(app, MOCK_ALIAS, {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            platform: ShortLinkPlatform.Builder,
          });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
      });
    });

    describe('DELETE /short-links/:itemId', () => {
      it('Not found if delete short links with invalid item id', async () => {
        const response = await injectDelete(app, MOCK_ALIAS);
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });

      describe('Forbidden', () => {
        afterEach(async () => {
          const check = await injectGet(app, MOCK_ALIAS);
          expect(check.statusCode).toEqual(StatusCodes.MOVED_TEMPORARILY);
        });
        it('Forbidden if delete when non admin user', async () => {
          const { item } = await testUtils.mockItemAndMemberships({
            itemCreator: actor,
            memberWithPermission: {
              member: bob,
              permission: PermissionLevel.Write,
            },
          });
          const payload = { itemId: item.id, alias: MOCK_ALIAS, platform: MOCK_PLATFORM };
          const post = await injectPost(app, payload);
          expect(post.statusCode).toEqual(StatusCodes.OK);
          expect(post.json().alias).toEqual(MOCK_ALIAS);

          // log in as bob
          mockAuthenticate(bob);

          const response = await injectDelete(app, MOCK_ALIAS);
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
      });

      describe('Success', () => {
        afterEach(async () => {
          const check = await injectGet(app, MOCK_ALIAS);
          expect(check.statusCode).toEqual(StatusCodes.NOT_FOUND);
        });
        it('Success when admin', async () => {
          const { item } = await testUtils.mockItemAndMemberships({
            itemCreator: bob,
            memberWithPermission: {
              member: actor,
              permission: PermissionLevel.Admin,
            },
          });
          const payload = { itemId: item.id, alias: MOCK_ALIAS, platform: MOCK_PLATFORM };
          const post = await injectPost(app, payload);
          expect(post.statusCode).toEqual(StatusCodes.OK);
          expect(post.json().alias).toEqual(MOCK_ALIAS);

          mockAuthenticate(bob);

          const response = await injectDelete(app, MOCK_ALIAS);
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json().alias).toEqual(MOCK_ALIAS);
        });
      });
    });

    describe('GET /short-links/available/:alias', () => {
      it('Available if not exists', async () => {
        const response = await injectGetAvailable(app, MOCK_ALIAS);
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json().available).toEqual(true);
      });

      it('Unavailable if exists', async () => {
        const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
        const payload = { itemId: item.id, alias: MOCK_ALIAS, platform: MOCK_PLATFORM };
        const post = await injectPost(app, payload);
        expect(post.statusCode).toEqual(StatusCodes.OK);
        expect(post.json().alias).toEqual(MOCK_ALIAS);

        const response = await injectGetAvailable(app, MOCK_ALIAS);
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json().available).toEqual(false);
      });
    });

    describe('GET /short-links/list/:itemId', () => {
      const platformLinks = [ShortLinkPlatform.Builder, ShortLinkPlatform.Player];
      beforeEach(async () => {
        cedric = await saveMember();
        anna = await saveMember();

        ({ item } = await testUtils.mockItemAndMemberships({
          itemCreator: actor,
          memberWithPermission: {
            member: bob,
            permission: PermissionLevel.Admin,
          },
        }));

        await testUtils.saveMembership({ item, account: anna, permission: PermissionLevel.Write });

        for (let i = 0; i < platformLinks.length; i++) {
          const platform = platformLinks[i];
          const response = await injectPost(app, {
            itemId: item.id,
            alias: `${MOCK_ALIAS}-${platform}`,
            platform: platform,
          });
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json().alias).toEqual(`${MOCK_ALIAS}-${platform}`);
        }
      });

      it('Not found if get short links with invalid item id', async () => {
        const response = await injectGetAll(app, MOCK_ITEM_ID);
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });

      describe('Forbidden', () => {
        it('Forbidden if no memberships on item', async () => {
          mockAuthenticate(cedric);
          const response = await injectGetAll(app, item.id);
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
      });

      describe('Success', () => {
        it('Success if item exist', async () => {
          const { item } = await testUtils.mockItemAndMemberships({ itemCreator: actor });
          const response = await injectGetAll(app, item.id);
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json()).toEqual({});
        });

        it('Success if read permission', async () => {
          mockAuthenticate(anna);
          const response = await injectGetAll(app, item.id);
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(Object.keys(response.json())).toHaveLength(platformLinks.length);
        });

        it('Success if admin', async () => {
          mockAuthenticate(bob);
          const response = await injectGetAll(app, item.id);
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(Object.keys(response.json())).toHaveLength(platformLinks.length);
        });
      });
    });
  });
});
