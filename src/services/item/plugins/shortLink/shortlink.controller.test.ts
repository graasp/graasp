import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { Context, ShortLinkPlatform } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { SHORT_LINK_BASE_URL } from '../../../../config/hosts';
import { db } from '../../../../drizzle/db';
import { shortLinksTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { ShortLinkDuplication, ShortLinkLimitExceed } from '../../../../utils/errors';
import { ItemPublishedNotFound } from '../publication/published/errors';
import {
  getRedirection,
  injectDelete,
  injectGet,
  injectGetAll,
  injectGetAvailable,
  injectPatch,
  injectPost,
} from './test/fixtures';

function expectException(response, ex) {
  expect(response.json().code).toBe(ex.code);
  expect(response.json().message).toBe(ex.message);
}

// since shortlink are unique on the whole database, mock values can collide
jest.retryTimes(3, { logErrorsBeforeRetry: true });

describe('Short links routes tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    // important to clear shortlinks because alias are unique over all the db
    await db.delete(shortLinksTable);
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('PUBLIC tests (member not connected)', () => {
    describe('POST /short-links without connected member', () => {
      it('Unauthorized if post short links without connected member', async () => {
        const alias = 'fake-alias';
        const response = await injectPost(app, {
          alias,
          itemId: v4(),
          platform: ShortLinkPlatform.Builder,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);

        const check = await injectGet(app, alias);
        expect(check.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
    });

    describe('GET /short-links/:itemId without connected member', () => {
      it('Success even if not connected', async () => {
        const {
          items: [item],
          shortLinks: [shortLink],
        } = await seedFromJson({ items: [{ shortLinks: [{}] }] });
        const response = await injectGet(app, shortLink.alias);
        expect(response.statusCode).toEqual(StatusCodes.MOVED_TEMPORARILY);
        expect(response.headers.location).toEqual(
          getRedirection(item.id, shortLink.platform as Context),
        );
      });
    });

    describe('PATCH /short-links/:itemId without connected member', () => {
      it('Unauthorized if patch short links without connected member', async () => {
        const response = await injectPatch(app, 'fake-alias', { alias: 'new-alias' });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('DELETE /short-links/:itemId without connected member', () => {
      it('Unauthorized if delete when not connected', async () => {
        const {
          shortLinks: [shortLink],
        } = await seedFromJson({ items: [{ shortLinks: [{}] }] });

        const response = await injectDelete(app, shortLink.alias);
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);

        const check = await injectGet(app, shortLink.alias);
        expect(check.statusCode).toEqual(StatusCodes.MOVED_TEMPORARILY);
      });
    });

    describe('GET /short-links/list/:itemId without connected member', () => {
      it('Unauthorized when not connected', async () => {
        const {
          items: [item],
        } = await seedFromJson({ items: [{}] });
        const response = await injectGetAll(app, item.id);
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });
  });

  describe('AUTHENTICATED member tests', () => {
    describe('POST /short-links', () => {
      describe('Forbidden access', () => {
        it('Forbidden if post short links with unauthorized member', async () => {
          const {
            items: [item],
            actor,
          } = await seedFromJson({ items: [{ creator: { name: 'bob' } }] });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPost(app, {
            itemId: item.id,
            alias: 'fake-alias',
            platform: ShortLinkPlatform.Builder,
          });
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
        it('Forbidden if post short links with write permission', async () => {
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [
              {
                creator: { name: 'bob' },
                memberships: [{ account: 'actor', permission: 'write' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPost(app, {
            itemId: item.id,
            alias: 'fake-alias',
            platform: ShortLinkPlatform.Builder,
          });
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
        it('Forbidden if post short links without permission on public', async () => {
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [
              {
                creator: { name: 'bob' },
                isPublic: true,
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPost(app, {
            itemId: item.id,
            alias: 'fake-alias',
            platform: ShortLinkPlatform.Builder,
          });
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
      });

      describe('Invalid Alias and body', () => {
        it('Bad request if post short links with alias < 6 chars', async () => {
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [
              {
                creator: 'actor',
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPost(app, {
            itemId: item.id,
            alias: '12345',
            platform: ShortLinkPlatform.Builder,
          });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
        it('Bad request if post short links with invalid alias chars', async () => {
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [
              {
                creator: 'actor',
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPost(app, {
            itemId: item.id,
            alias: '1_2$3<45',
            platform: ShortLinkPlatform.Builder,
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
          const {
            items: [_item, toItem],
            actor,
            shortLinks: [shortlink],
          } = await seedFromJson({
            items: [
              { shortLinks: [{}] },
              { memberships: [{ account: 'actor', permission: 'admin' }] },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);
          const response = await injectPost(app, {
            itemId: toItem.id,
            alias: shortlink.alias,
            platform: shortlink.platform,
          });

          expectException(response, new ShortLinkDuplication(shortlink.alias));
        });

        it('Conflict if post short links with already exist platform (limit of one link per platform per item)', async () => {
          const {
            items: [item],
            actor,
            shortLinks: [shortlink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const alias = 'my-alias';
          const response = await injectPost(app, {
            itemId: item.id,
            alias,
            platform: shortlink.platform,
          });
          expectException(response, new ShortLinkLimitExceed(alias, shortlink.platform));
        });
      });

      describe('Library short link', () => {
        it('Error if post short links with library platform on unpublished item', async () => {
          const {
            items: [item],
            actor,
          } = await seedFromJson({
            items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPost(app, {
            itemId: item.id,
            alias: 'fake-alias',
            platform: Context.Library,
          });

          expectException(response, new ItemPublishedNotFound());
        });
        it('Succeed if post short links with library platform on published item with admin permission', async () => {
          const {
            items: [item],
            actor,
          } = await seedFromJson({
            items: [
              {
                memberships: [{ account: 'actor', permission: 'admin' }],
                isPublic: true,
                isPublished: true,
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const alias = 'my-alias';
          const response = await injectPost(app, {
            itemId: item.id,
            alias,
            platform: Context.Library,
          });
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json().alias).toEqual(alias);
          expect(response.json().platform).toEqual(Context.Library);
        });
      });
      describe('Not Found', () => {
        it('Not found if post short links with item id that not exists', async () => {
          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const alias = 'fake-alias';
          const response = await injectPost(app, {
            alias,
            itemId: v4(),
            platform: ShortLinkPlatform.Builder,
          });
          expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
          const check = await injectGet(app, alias);
          expect(check.statusCode).toEqual(StatusCodes.NOT_FOUND);
        });
      });
      describe('Authorized Posts', () => {
        it('Success if post short links with admin permission', async () => {
          const {
            items: [item],
            actor,
          } = await seedFromJson({
            items: [
              {
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const shortLinkPayload = {
            itemId: item.id,
            alias: 'my-alias-is-cool',
            platform: ShortLinkPlatform.Builder,
          };
          const response = await injectPost(app, shortLinkPayload);
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json().alias).toEqual(shortLinkPayload.alias);
        });
      });
    });
    describe('GET /short-links/:itemId', () => {
      it('Not found if get short links with item id that does not exist', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await injectGet(app, 'fake-alias');
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
      it('Success even if no permission', async () => {
        const {
          items: [item],
          actor,
          shortLinks: [shortLink],
        } = await seedFromJson({
          items: [{ shortLinks: [{}] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await injectGet(app, shortLink.alias);
        expect(response.statusCode).toEqual(StatusCodes.MOVED_TEMPORARILY);
        expect(response.headers.location).toEqual(
          getRedirection(item.id, shortLink.platform as Context),
        );
      });
      it('Success when admin', async () => {
        const {
          items: [item],
          actor,
          shortLinks: [shortLink],
        } = await seedFromJson({
          items: [
            {
              shortLinks: [{}],
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await injectGet(app, shortLink.alias);
        expect(response.statusCode).toEqual(StatusCodes.MOVED_TEMPORARILY);
        expect(response.headers.location).toEqual(
          getRedirection(item.id, shortLink.platform as Context),
        );
      });
    });
    describe('PATCH /short-links/:itemId', () => {
      it('Not found if patch short links with invalid item id', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await injectPatch(app, 'fake-alias', { alias: 'new-alias' });
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
      describe('Forbidden', () => {
        it('Forbidden if patch short links with write permission', async () => {
          const {
            actor,
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'write' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPatch(app, shortLink.alias, { alias: 'new-alias' });
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
      });
      describe('Success', () => {
        it('Success if patch short links with admin permission', async () => {
          const {
            actor,
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPatch(app, shortLink.alias, { alias: 'new-alias' });

          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json().platform).toEqual(shortLink.platform);
          expect(response.json().alias).toEqual('new-alias');
        });
      });
      describe('Conflict and bad request', () => {
        it('Conflict if patch short links alias with existing one', async () => {
          const {
            actor,
            shortLinks: [shortLink, anotherShortlink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
              {
                shortLinks: [{}],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPatch(app, shortLink.alias, {
            alias: anotherShortlink.alias,
          });
          expect(response.statusCode).toEqual(StatusCodes.CONFLICT);
        });
        it('Bad request if patch short links alias < 6 chars', async () => {
          const {
            actor,
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPatch(app, shortLink.alias, { alias: '12345' });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
        it('Bad request if patch short links alias invalid chars', async () => {
          const {
            actor,
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPatch(app, shortLink.alias, { alias: 'test$_123' });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
        it('Bad request if patch short links with empty body', async () => {
          const {
            actor,
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          const response = await injectPatch(app, shortLink.alias, {});
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
        it('Bad request if patch short links without body', async () => {
          const {
            actor,
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPatch(app, shortLink.alias);
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
        it('Bad request if patch short links with missing attributes in body', async () => {
          const {
            actor,
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          const response = await injectPatch(app, shortLink.alias, { not_valid: 0 });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
        it('Bad request if patch short links to change item', async () => {
          const {
            actor,
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          const response = await injectPatch(app, shortLink.alias, { itemId: v4() });
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
        it('Bad request if patch short links to change platform', async () => {
          const {
            actor,
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectPatch(app, shortLink.alias, {
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
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await injectDelete(app, 'fake-alias');
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
      describe('Forbidden', () => {
        it('Forbidden if delete when non admin user', async () => {
          const {
            actor,
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'read' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectDelete(app, shortLink.alias);
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
      });
      describe('Success', () => {
        it('Success when admin', async () => {
          const {
            actor,
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectDelete(app, shortLink.alias);
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json().alias).toEqual(shortLink.alias);
        });
      });
    });
    describe('GET /short-links/available/:alias', () => {
      it('Available if not exists', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await injectGetAvailable(app, 'fake-alias');
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json().available).toEqual(true);
      });
      it('Unavailable if exists', async () => {
        const {
          actor,
          shortLinks: [shortLink],
        } = await seedFromJson({
          items: [
            {
              shortLinks: [{}],
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await injectGetAvailable(app, shortLink.alias);
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json().available).toEqual(false);
      });
    });
    describe('GET /short-links/list/:itemId', () => {
      it('Not found if get short links with invalid item id', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await injectGetAll(app, v4());
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
      describe('Forbidden', () => {
        it('Forbidden if no memberships on item', async () => {
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [
              {
                shortLinks: [{}],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectGetAll(app, item.id);
          expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        });
      });
      describe('Success', () => {
        it('Success if item exist', async () => {
          const {
            actor,
            items: [item],
            shortLinks: [shortLink],
          } = await seedFromJson({
            items: [
              {
                memberships: [{ account: 'actor', permission: 'admin' }],
                shortLinks: [{}],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectGetAll(app, item.id);
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json()).toEqual({
            [shortLink.platform]: {
              alias: shortLink.alias,
              url: `${SHORT_LINK_BASE_URL}/${shortLink.alias}`,
            },
          });
        });
        it('Success if read permission', async () => {
          const {
            actor,
            items: [item],
            shortLinks,
          } = await seedFromJson({
            items: [
              {
                shortLinks: [
                  { platform: ShortLinkPlatform.Builder },
                  { platform: ShortLinkPlatform.Player },
                ],
                memberships: [{ account: 'actor', permission: 'read' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectGetAll(app, item.id);
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(Object.keys(response.json())).toHaveLength(shortLinks.length);
        });
        it('Success if admin', async () => {
          const {
            actor,
            items: [item],
            shortLinks,
          } = await seedFromJson({
            items: [
              {
                shortLinks: [
                  { platform: ShortLinkPlatform.Builder },
                  { platform: ShortLinkPlatform.Player },
                ],
                memberships: [{ account: 'actor', permission: 'admin' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await injectGetAll(app, item.id);
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(Object.keys(response.json())).toHaveLength(shortLinks.length);
        });
      });
    });
  });
});
