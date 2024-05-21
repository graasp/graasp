import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { AppDataSource } from '../../../../../plugins/datasource';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { saveMember } from '../../../../member/test/fixtures/members';
import { ItemTestUtils } from '../../../test/fixtures/items';
import { ItemFavorite } from '../entities/ItemFavorite';
import { DuplicateFavoriteError } from '../errors';
import { FavoriteRepository } from '../repositories/favorite';

// mock datasource
jest.mock('../../../../../plugins/datasource');

const rawRepository = AppDataSource.getRepository(ItemFavorite);
const testUtils = new ItemTestUtils();

describe('Favorite', () => {
  let app: FastifyInstance;
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
    void app.close();
  });

  describe('GET /favorite', () => {
    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        await testUtils.saveItemAndMembership({ member: actor }); // Unused second item

        favorite = await rawRepository.save({ item, member: actor });
      });

      it('Get favorite', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/favorite`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()[0]).toMatchObject(
          expect.objectContaining({
            item: expect.objectContaining({
              id: favorite.item.id,
              creator: expect.objectContaining({ id: favorite.item.creator.id }),
            }),
          }),
        );
      });

      it('Get favorite with trashed favorite item', async () => {
        await testUtils.rawItemRepository.softDelete(favorite.item.id);
        const res = await app.inject({
          method: HttpMethod.Get,
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

        member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({ member }));
      });

      it('Throws', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
        });
        expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await testUtils.saveItemAndMembership({ member: actor }));
      });

      it('Post a new favorite', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
        });

        const favorites = await new FavoriteRepository().getFavoriteForMember(actor.id);

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject({ item: { id: item.id } });
        expect(favorites).toHaveLength(1);
        expect(favorites[0]).toMatchObject({ item: { id: item.id } });
      });

      it('Post the same favorite throws', async () => {
        // Add the favorite the first time
        await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
        });

        // Add the same favorite a second time
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
        });

        expect(res.statusCode).toBe(StatusCodes.CONFLICT); // Assuming the POST endpoint returns 409 CONFLICT on duplicate
        expect(res.json()).toMatchObject(new DuplicateFavoriteError(expect.anything()));
      });

      it('Bad request if id is invalid', async () => {
        const invalidId = '123456-invalid';

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/favorite/${invalidId}`,
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
    describe('DELETE /favorite/:id', () => {
      describe('Signed out', () => {
        beforeEach(async () => {
          ({ app } = await build({ member: null }));
          member = await saveMember();
          ({ item } = await testUtils.saveItemAndMembership({ member }));
        });

        it('Throws if not authenticated', async () => {
          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
          });

          expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
        });
      });

      describe('Signed in', () => {
        beforeEach(async () => {
          ({ app, actor } = await build());
          ({ item } = await testUtils.saveItemAndMembership({ member: actor }));
          favorite = await new FavoriteRepository().post(item.id, actor.id);
        });

        it('Delete removes favorite', async () => {
          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/favorite/${item.id}`,
          });

          expect(res.statusCode).toBe(StatusCodes.OK);

          const favorites = await new FavoriteRepository().getFavoriteForMember(actor.id);
          expect(favorites).toHaveLength(0);
        });
      });
    });
  });
});
