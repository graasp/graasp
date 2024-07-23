import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import build, { clearDatabase } from '../../../../../../test/app';
import { AppDataSource } from '../../../../../plugins/datasource';
import { saveMember } from '../../../../member/test/fixtures/members';
import { ItemTestUtils } from '../../../test/fixtures/items';
import { ItemFavorite } from '../entities/ItemFavorite';
import { DuplicateFavoriteError, ItemFavoriteNotFound } from '../errors';
import { FavoriteRepository } from './favorite';

// mock datasource
// jest.mock('../../../../../plugins/datasource');
const testUtils = new ItemTestUtils();

describe('FavoriteRepository', () => {
  let app: FastifyInstance;
  let actor;
  let favorites: ItemFavorite[];

  beforeEach(async () => {
    ({ app, actor } = await build());
    const r = new FavoriteRepository();
    const rawRepository = AppDataSource.getRepository(ItemFavorite);
    const item1 = await testUtils.saveItem({ actor });
    const item2 = await testUtils.saveItem({ actor });
    favorites = [
      await rawRepository.save({ item: item1, member: actor }),
      await rawRepository.save({ item: item2, member: actor }),
    ];

    // noise
    const m1 = await saveMember();
    await r.post(item1.id, m1.id);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    favorites = [];
    app.close();
  });

  describe('get', () => {
    it('returns favorite by id', async () => {
      const r = new FavoriteRepository();
      const f = favorites[0];
      const result = await r.get(f.id);
      expect(result).toMatchObject({
        item: expect.objectContaining({ id: f.item.id }),
      });
    });

    it('throws if id is undefined', async () => {
      const r = new FavoriteRepository();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await expect(r.get(undefined!)).rejects.toMatchObject(new ItemFavoriteNotFound(undefined));
    });

    it('throws if favorite does not exist', async () => {
      const r = new FavoriteRepository();
      const id = v4();
      await expect(r.get(id)).rejects.toMatchObject(new ItemFavoriteNotFound(id));
    });
  });

  describe('getFavoriteForMember', () => {
    it('returns all favorites for member', async () => {
      const r = new FavoriteRepository();

      const result = await r.getFavoriteForMember(actor.id);
      expect(result).toHaveLength(favorites.length);
      for (const f of favorites) {
        expect(result).toContainEqual(
          expect.objectContaining({
            item: expect.objectContaining({
              id: f.item.id,
              creator: expect.objectContaining({ id: f.item?.creator?.id }),
            }),
          }),
        );
      }
    });

    it('returns empty array if no favorite', async () => {
      const r = new FavoriteRepository();

      const result = await r.getFavoriteForMember(v4());
      expect(result).toHaveLength(0);
    });
  });

  describe('post', () => {
    it('save and return favorite', async () => {
      const r = new FavoriteRepository();
      const item = await testUtils.saveItem({ actor });

      // returned value
      const result = await r.post(item.id, actor.id);
      expect(result).toMatchObject({
        item: expect.objectContaining({ id: item.id }),
      });

      // saved value
      expect(await r.get(result.id)).toMatchObject({
        item: expect.objectContaining({ id: item.id }),
      });
    });

    it('throws if duplicate', async () => {
      const r = new FavoriteRepository();

      await expect(r.post(favorites[0].item.id, favorites[0].member.id)).rejects.toMatchObject(
        new DuplicateFavoriteError({
          itemId: favorites[0].item.id,
          memberId: favorites[0].member.id,
        }),
      );
    });
  });

  describe('deleteOne', () => {
    it('delete favorite', async () => {
      const r = new FavoriteRepository();
      const f = favorites[0];
      // returned value
      const result = await r.deleteOne(f.item.id, f.member.id);
      expect(result).toEqual(f.item.id);

      // saved value
      await expect(r.get(f.id)).rejects.toMatchObject(new ItemFavoriteNotFound(f.id));
    });

    it('do nothing if no favorite exists', async () => {
      const r = new FavoriteRepository();
      const item = await testUtils.saveItem({ actor });

      // returned value
      const result = await r.deleteOne(item.id, actor.id);
      expect(result).toEqual(item.id);
    });
  });
});
