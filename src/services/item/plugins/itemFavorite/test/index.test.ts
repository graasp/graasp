import { StatusCodes } from 'http-status-codes';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { BOB, saveMember } from '../../../../member/test/fixtures/members';
import { ItemRepository } from '../../../repository';
import { DuplicateFavoriteError } from '../errors';
import { FavoriteRepository } from '../repositories/favorite';

// mock datasource
jest.mock('../../../../../plugins/datasource');

describe('Favorite', () => {
  let app;
  let actor;
  let member;
  let item;
  let favorite;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    member = null;
    item = null;
    favorite = null;
    app.close();
  });

  describe('GET /favorite', () => {
    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        const { item } = await saveItemAndMembership({ member: actor });
        await saveItemAndMembership({ member: actor }); // Unused second item

        favorite = await FavoriteRepository.post(item.id, actor.id);
      });

      it('Get favorite', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/favorite`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()[0]).toMatchObject({ item: { id: favorite.item.id } });
      });

      it('Get favorite with trashed favorite item', async () => {
        await ItemRepository.softDelete(favorite.item.id);
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/favorite`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toStrictEqual([]);
      });
    });
  });

  describe('POST /favorite/:id', () => {
    describe('Signed out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));

        member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));
      });

      it('Throws', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
        });
        expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await saveItemAndMembership({ member: actor }));
      });

      it('Post a new favorite', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
        });

        const favorites = await FavoriteRepository.getFavoriteForMember(actor.id);

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject({ item: { id: item.id } });
        expect(favorites).toHaveLength(1);
        expect(favorites[0]).toMatchObject({ item: { id: item.id } });
      });

      it('Post the same favorite throws', async () => {
        // Add the favorite the first time
        await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
        });

        // Add the same favorite a second time
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
        });

        expect(res.statusCode).toBe(StatusCodes.CONFLICT); // Assuming the POST endpoint returns 409 CONFLICT on duplicate
        expect(res.json()).toMatchObject(new DuplicateFavoriteError(expect.anything()));
      });

      it('Bad request if id is invalid', async () => {
        const invalidId = '123456-invalid';

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/favorite/${invalidId}`,
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
    describe('DELETE /favorite/:id', () => {
      describe('Signed out', () => {
        beforeEach(async () => {
          ({ app } = await build({ member: null }));
          member = await saveMember(BOB);
          ({ item } = await saveItemAndMembership({ member }));
        });

        it('Throws if not authenticated', async () => {
          const res = await app.inject({
            method: HttpMethod.DELETE,
            url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
          });

          expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
        });
      });

      describe('Signed in', () => {
        beforeEach(async () => {
          ({ app, actor } = await build());
          ({ item } = await saveItemAndMembership({ member: actor }));
          favorite = await FavoriteRepository.post(item.id, actor.id);
        });

        it('Delete removes favorite', async () => {
          const res = await app.inject({
            method: HttpMethod.DELETE,
            url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
          });

          expect(res.statusCode).toBe(StatusCodes.OK);

          const favorites = await FavoriteRepository.getFavoriteForMember(actor.id);
          expect(favorites).toHaveLength(0);
        });
      });
    });
  });
});
